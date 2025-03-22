from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional, Tuple
import json
import os

from ..game import Game, Player, Piece

# Models for request/response serialization
class MoveRequest(BaseModel):
    game_id: str
    piece_id: int
    player: int  # 1 or 2

class GameState(BaseModel):
    current_player: int
    dice_result: int
    game_over: bool
    winner: Optional[int]
    board: list[list[Optional[int]]]  # 2D array representing the board state
    player1_pieces_in_hand: int
    player2_pieces_in_hand: int
    player1_completed: int
    player2_completed: int
    valid_moves: Optional[list[tuple[int, int]]] = None

# Store active games in memory (in production, use a proper database)
active_games: Dict[str, Game] = {}

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Get the directory containing this file
current_dir = os.path.dirname(os.path.abspath(__file__))

# Mount static files
static_dir = os.path.join(current_dir, "static")
if not os.path.exists(static_dir):
    os.makedirs(static_dir)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

def serialize_game_state(game: Game) -> GameState:
    """Convert Game object to serializable GameState."""
    # Create 3x8 board representation
    board = [[None for _ in range(8)] for _ in range(3)]
    
    # Fill in pieces on the board
    for pos, square in game.board.squares.items():
        if square.piece:
            board[pos[0]][pos[1]] = square.piece.player.value
    
    # Get valid moves if dice have been rolled
    valid_moves = None
    if game.dice_result > 0:
        valid_pieces = game.get_valid_moves()
        valid_moves = [piece.position for piece in valid_pieces if piece.position]
    
    return GameState(
        current_player=game.current_player.value,
        dice_result=game.dice_result,
        game_over=game.game_over,
        winner=game.winner.value if game.winner else None,
        board=board,
        player1_pieces_in_hand=len(game.board.pieces_in_hand[Player.ONE]),
        player2_pieces_in_hand=len(game.board.pieces_in_hand[Player.TWO]),
        player1_completed=sum(1 for p in game.board.pieces[Player.ONE] if p.completed),
        player2_completed=sum(1 for p in game.board.pieces[Player.TWO] if p.completed),
        valid_moves=valid_moves
    )

@app.get("/")
async def get_index():
    """Serve the game's HTML page."""
    template_path = os.path.join(current_dir, "templates", "index.html")
    if not os.path.exists(template_path):
        return HTMLResponse(content="Error: Template file not found", status_code=500)
    with open(template_path) as f:
        return HTMLResponse(content=f.read())

@app.post("/api/games", response_model=GameState)
async def create_game():
    """Create a new game and return its initial state."""
    game = Game()
    game_id = str(len(active_games) + 1)  # Simple ID generation
    active_games[game_id] = game
    return serialize_game_state(game)

@app.get("/api/games/{game_id}", response_model=GameState)
async def get_game_state(game_id: str):
    """Get the current state of a game."""
    if game_id not in active_games:
        raise HTTPException(status_code=404, detail="Game not found")
    return serialize_game_state(active_games[game_id])

@app.post("/api/games/{game_id}/roll", response_model=GameState)
async def roll_dice(game_id: str):
    """Roll the dice for the current player."""
    if game_id not in active_games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = active_games[game_id]
    if game.game_over:
        raise HTTPException(status_code=400, detail="Game is over")
    
    game.roll_dice()
    return serialize_game_state(game)

@app.post("/api/games/{game_id}/move", response_model=GameState)
async def make_move(game_id: str, move: MoveRequest):
    """Make a move in the game."""
    if game_id not in active_games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = active_games[game_id]
    if game.game_over:
        raise HTTPException(status_code=400, detail="Game is over")
    
    if game.current_player != Player(move.player):
        raise HTTPException(status_code=400, detail="Not your turn")
    
    # Find the piece to move
    piece = None
    for p in game.board.pieces[Player(move.player)]:
        if p.piece_id == move.piece_id:
            piece = p
            break
    
    if not piece:
        raise HTTPException(status_code=400, detail="Invalid piece")
    
    try:
        extra_turn = game.make_move(piece)
        if not extra_turn:
            game.next_turn()
        return serialize_game_state(game)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.websocket("/ws/{game_id}")
async def websocket_endpoint(websocket: WebSocket, game_id: str):
    """WebSocket endpoint for real-time game updates."""
    await websocket.accept()
    try:
        while True:
            # Wait for messages (can be used for chat or real-time updates)
            data = await websocket.receive_text()
            # Echo back game state
            if game_id in active_games:
                state = serialize_game_state(active_games[game_id])
                await websocket.send_text(json.dumps(state.dict()))
    except:
        await websocket.close() 