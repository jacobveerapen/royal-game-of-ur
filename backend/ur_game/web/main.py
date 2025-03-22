from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional, Tuple, Any, Deque
import json
import os
import subprocess
import sys
import threading
import asyncio
import uuid
import logging
from datetime import datetime
from collections import deque
import time

import pty  # Add PTY for better interactive process handling
import fcntl  # For setting non-blocking IO

from ..game import Game, Player, Piece

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Models for request/response serialization
class MoveRequest(BaseModel):
    game_id: str
    piece_id: int
    player: int  # 1 or 2

class GameCommandRequest(BaseModel):
    command: str

class CommandResponse(BaseModel):
    output: str

class TerminalSessionResponse(BaseModel):
    session_id: str
    message: str

class TerminalOutputResponse(BaseModel):
    lines: List[str]
    has_more: bool

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

# Store terminal session
terminal_sessions: Dict[str, Any] = {}

# Store terminal output buffers for HTTP fallback
terminal_output_buffers: Dict[str, Deque[str]] = {}

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

# Clean up any orphaned processes
async def cleanup_terminal_sessions():
    """Clean up terminal sessions that are inactive for too long."""
    while True:
        await asyncio.sleep(60)  # Check every minute
        now = datetime.now()
        to_remove = []
        
        for session_id, session in terminal_sessions.items():
            # Remove sessions inactive for more than 30 minutes
            if (now - session['last_activity']).total_seconds() > 1800:
                to_remove.append(session_id)
        
        for session_id in to_remove:
            session = terminal_sessions.pop(session_id, None)
            if session and session['process']:
                try:
                    session['process'].terminate()
                    session['process'].wait(timeout=5)
                except:
                    if session['process'].poll() is None:
                        session['process'].kill()

# Start cleanup task
@app.on_event("startup")
async def startup_event():
    asyncio.create_task(cleanup_terminal_sessions())

# Terminal WebSocket Connection
@app.websocket("/terminal")
async def terminal_websocket(websocket: WebSocket):
    await websocket.accept()
    logger.info("New terminal WebSocket connection accepted")
    
    # Generate session ID
    session_id = str(uuid.uuid4())
    process = None
    master_fd = None
    slave_fd = None
    
    try:
        # Get the root directory of the project
        project_root = os.path.abspath(os.path.join(current_dir, "../../../"))
        run_game_path = os.path.join(project_root, "run_game.py")
        logger.info(f"Starting process for {run_game_path}")
        
        # Create a pseudo-terminal
        master_fd, slave_fd = pty.openpty()
        
        # Set non-blocking mode on the master file descriptor
        flags = fcntl.fcntl(master_fd, fcntl.F_GETFL)
        fcntl.fcntl(master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)
        
        # Start the process with the slave end of the PTY
        process = subprocess.Popen(
            [sys.executable, run_game_path],
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            close_fds=True,
            text=True
        )
        
        # Store the session
        terminal_sessions[session_id] = {
            'process': process,
            'websocket': websocket,
            'last_activity': datetime.now(),
            'master_fd': master_fd,
            'slave_fd': slave_fd
        }
        
        logger.info(f"Process started with PID: {process.pid if process else 'unknown'}")
        
        # Process output reader task
        async def read_output():
            logger.info("Starting output reader task")
            buffer = ""
            
            while process.poll() is None:
                try:
                    # Read from the master end of the PTY
                    try:
                        data = os.read(master_fd, 1024).decode('utf-8')
                        if data:
                            buffer += data
                            
                            # Process complete lines
                            lines = buffer.split('\n')
                            for i, line in enumerate(lines[:-1]):  # All complete lines
                                logger.info(f"Output from process: {line}")
                                await websocket.send_json({
                                    'type': 'output',
                                    'content': line + '\n'
                                })
                            
                            # Keep any partial line in the buffer
                            buffer = lines[-1]
                            
                            # If we have a partial line and it ends with specific prompts, send it immediately
                            # Special handling for the game's prompts like "Press Enter to roll dice..."
                            if buffer and (
                                any(buffer.endswith(c) for c in [':', '>', '$', '#']) or
                                "Press Enter" in buffer or
                                "Choose a piece" in buffer or
                                "enter number" in buffer
                            ):
                                logger.info(f"Sending prompt: {buffer}")
                                await websocket.send_json({
                                    'type': 'output',
                                    'content': buffer
                                })
                                buffer = ""
                    except (OSError, BlockingIOError):
                        # No data available, just continue
                        pass
                    
                    await asyncio.sleep(0.05)  # Small delay between reads
                except Exception as e:
                    logger.error(f"Error reading process output: {e}")
                    break
            
            # Send any remaining buffer content
            if buffer:
                logger.info(f"Sending remaining buffer: {buffer}")
                await websocket.send_json({
                    'type': 'output',
                    'content': buffer
                })
            
            # Send exit message when process ends
            exit_code = process.poll()
            logger.info(f"Process exited with code: {exit_code}")
            await websocket.send_json({
                'type': 'exit',
                'exit_code': exit_code
            })
        
        # Start output reader
        output_task = asyncio.create_task(read_output())
        
        # Handle input from client
        while True:
            message = await websocket.receive_json()
            logger.info(f"Received message: {message}")
            terminal_sessions[session_id]['last_activity'] = datetime.now()
            
            if message['type'] == 'input':
                if process.poll() is None:  # Process is still running
                    command = message['content'] + '\n'
                    logger.info(f"Sending command to process: {command.strip() or '<ENTER>'}")
                    
                    # Write to the master end of the PTY
                    os.write(master_fd, command.encode('utf-8'))
            elif message['type'] == 'resize':
                # Terminal resize event - could be handled with pty if needed
                pass
    
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
        # Clean up on disconnect
        if process and process.poll() is None:
            logger.info(f"Terminating process: {process.pid}")
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                logger.warning(f"Process did not terminate, killing: {process.pid}")
                process.kill()
                
        # Close PTY file descriptors
        if master_fd is not None:
            os.close(master_fd)
        if slave_fd is not None:
            os.close(slave_fd)
            
        terminal_sessions.pop(session_id, None)
    
    except Exception as e:
        logger.error(f"Terminal websocket error: {e}")
        
        # Try to send error to client
        try:
            await websocket.send_json({
                'type': 'error',
                'content': str(e)
            })
        except:
            pass
        
        # Clean up
        if process and process.poll() is None:
            logger.info(f"Terminating process due to error: {process.pid}")
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                logger.warning(f"Process did not terminate, killing: {process.pid}")
                process.kill()
                
        # Close PTY file descriptors
        if master_fd is not None:
            os.close(master_fd)
        if slave_fd is not None:
            os.close(slave_fd)
            
        terminal_sessions.pop(session_id, None)

# For compatibility with existing code - to be deprecated
@app.post("/api/run-game", response_model=CommandResponse)
async def run_game():
    """Run the game via the terminal interface."""
    return CommandResponse(
        output="Please use the WebSocket terminal interface for interactive sessions. Connect to the /terminal WebSocket endpoint."
    )

@app.post("/api/game-command", response_model=CommandResponse)
async def execute_command(command_req: GameCommandRequest):
    """Execute a command in the game."""
    return CommandResponse(
        output="Please use the WebSocket terminal interface for interactive sessions. Connect to the /terminal WebSocket endpoint."
    )

# HTTP-based terminal API (fallback for WebSocket)
def create_terminal_process():
    """Create a process running run_game.py and return its details"""
    # Get the root directory of the project
    project_root = os.path.abspath(os.path.join(current_dir, "../../../"))
    run_game_path = os.path.join(project_root, "run_game.py")
    logger.info(f"Starting process for {run_game_path} via HTTP API")
    
    # Create a pseudo-terminal
    master_fd, slave_fd = pty.openpty()
    
    # Set non-blocking mode on the master file descriptor
    flags = fcntl.fcntl(master_fd, fcntl.F_GETFL)
    fcntl.fcntl(master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)
    
    # Start the process with the slave end of the PTY
    process = subprocess.Popen(
        [sys.executable, run_game_path],
        stdin=slave_fd,
        stdout=slave_fd,
        stderr=slave_fd,
        close_fds=True,
        text=True
    )
    
    session_id = str(uuid.uuid4())
    
    # Create a buffer for output
    terminal_output_buffers[session_id] = deque(maxlen=1000)  # Store up to 1000 lines
    
    # Store the session
    terminal_sessions[session_id] = {
        'process': process,
        'last_activity': datetime.now(),
        'http_mode': True,
        'master_fd': master_fd,
        'slave_fd': slave_fd
    }
    
    logger.info(f"HTTP terminal process started with PID: {process.pid}, session ID: {session_id}")
    
    return session_id, process, master_fd, slave_fd

def read_terminal_output(session_id: str, process, master_fd):
    """Background task to read output from the process and store it in a buffer"""
    logger.info(f"Starting output reader for HTTP terminal session {session_id}")
    buffer = ""
    
    while True:
        # Check if process still exists
        if session_id not in terminal_sessions:
            logger.info(f"Session {session_id} has been removed, stopping reader")
            break
            
        # Check if process is still running
        if process.poll() is not None:
            logger.info(f"Process for session {session_id} has exited with code {process.poll()}")
            terminal_output_buffers[session_id].append(f"Process exited with code {process.poll()}")
            break
        
        # Read a line from process output
        try:
            try:
                data = os.read(master_fd, 1024).decode('utf-8')
                if data:
                    buffer += data
                    
                    # Process complete lines
                    lines = buffer.split('\n')
                    for i, line in enumerate(lines[:-1]):  # All complete lines
                        logger.info(f"HTTP output from process ({session_id}): {line}")
                        terminal_output_buffers[session_id].append(line)
                    
                    # Keep any partial line in the buffer
                    buffer = lines[-1]
                    
                    # If we have a partial line and it ends with specific prompts, send it immediately
                    # Special handling for the game's prompts like "Press Enter to roll dice..."
                    if buffer and (
                        any(buffer.endswith(c) for c in [':', '>', '$', '#', '.']) or
                        "Press Enter" in buffer or
                        "Choose a piece" in buffer or
                        "enter number" in buffer
                    ):
                        logger.info(f"HTTP sending prompt ({session_id}): {buffer}")
                        terminal_output_buffers[session_id].append(buffer)
                        buffer = ""
            except (OSError, BlockingIOError):
                # No data available, just continue
                pass
                
            # Small delay between reads
            time.sleep(0.05)
        except Exception as e:
            logger.error(f"Error reading process output for HTTP session {session_id}: {e}")
            terminal_output_buffers[session_id].append(f"Error reading output: {str(e)}")
            break
            
    # Send any remaining buffer content
    if buffer:
        logger.info(f"HTTP sending remaining buffer ({session_id}): {buffer}")
        terminal_output_buffers[session_id].append(buffer)
            
    # Process has exited or error occurred
    if session_id in terminal_sessions:
        logger.info(f"Removing HTTP terminal session {session_id}")
        if process.poll() is None:
            # Process is still running, terminate it
            try:
                process.terminate()
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                
        # Close PTY file descriptors
        master_fd = terminal_sessions[session_id].get('master_fd')
        slave_fd = terminal_sessions[session_id].get('slave_fd')
        
        if master_fd is not None:
            try:
                os.close(master_fd)
            except OSError:
                pass
            
        if slave_fd is not None:
            try:
                os.close(slave_fd)
            except OSError:
                pass
            
        terminal_sessions.pop(session_id, None)

@app.post("/api/terminal/create", response_model=TerminalSessionResponse)
async def create_terminal_session(background_tasks: BackgroundTasks):
    """Create a new terminal session and start the run_game.py process"""
    try:
        session_id, process, master_fd, slave_fd = create_terminal_process()
        
        # Start background task to read output
        background_tasks.add_task(read_terminal_output, session_id, process, master_fd)
        
        return TerminalSessionResponse(
            session_id=session_id,
            message="Terminal session created successfully"
        )
    except Exception as e:
        logger.error(f"Error creating terminal session: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Error creating terminal session: {str(e)}"}
        )

@app.get("/api/terminal/{session_id}/output", response_model=TerminalOutputResponse)
async def get_terminal_output(session_id: str):
    """Get output from a terminal session"""
    if session_id not in terminal_sessions:
        return JSONResponse(
            status_code=404,
            content={"error": "Terminal session not found"}
        )
    
    # Update last activity time
    terminal_sessions[session_id]['last_activity'] = datetime.now()
    
    # Get output from buffer
    if session_id in terminal_output_buffers:
        lines = list(terminal_output_buffers[session_id])
        # Clear the buffer after reading
        terminal_output_buffers[session_id].clear()
        return TerminalOutputResponse(
            lines=lines,
            has_more=terminal_sessions[session_id]['process'].poll() is None
        )
    else:
        return TerminalOutputResponse(
            lines=[],
            has_more=False
        )

@app.post("/api/terminal/{session_id}/input")
async def send_terminal_input(session_id: str, command_req: GameCommandRequest):
    """Send input to a terminal session"""
    if session_id not in terminal_sessions:
        return JSONResponse(
            status_code=404,
            content={"error": "Terminal session not found"}
        )
    
    # Update last activity time
    terminal_sessions[session_id]['last_activity'] = datetime.now()
    
    process = terminal_sessions[session_id]['process']
    master_fd = terminal_sessions[session_id].get('master_fd')
    
    # Check if process is still running
    if process.poll() is not None:
        return JSONResponse(
            status_code=400,
            content={"error": f"Process has exited with code {process.poll()}"}
        )
    
    # Check if we have a master file descriptor
    if master_fd is None:
        return JSONResponse(
            status_code=500,
            content={"error": "Terminal session is not properly initialized"}
        )
    
    try:
        command = command_req.command + '\n'
        logger.info(f"Sending command to HTTP terminal process ({session_id}): {command.strip() or '<ENTER>'}")
        
        # Write to the master end of the PTY
        os.write(master_fd, command.encode('utf-8'))
        
        return {"status": "Command sent successfully"}
    except Exception as e:
        logger.error(f"Error sending command to process ({session_id}): {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Error sending command: {str(e)}"}
        )

@app.delete("/api/terminal/{session_id}")
async def delete_terminal_session(session_id: str):
    """Terminate a terminal session"""
    if session_id not in terminal_sessions:
        return JSONResponse(
            status_code=404,
            content={"error": "Terminal session not found"}
        )
    
    process = terminal_sessions[session_id]['process']
    
    # Terminate the process
    if process.poll() is None:
        try:
            process.terminate()
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
    
    # Close PTY file descriptors
    master_fd = terminal_sessions[session_id].get('master_fd')
    slave_fd = terminal_sessions[session_id].get('slave_fd')
    
    if master_fd is not None:
        try:
            os.close(master_fd)
        except OSError:
            pass
            
    if slave_fd is not None:
        try:
            os.close(slave_fd)
        except OSError:
            pass
    
    # Remove session
    terminal_sessions.pop(session_id, None)
    
    # Remove buffer
    if session_id in terminal_output_buffers:
        terminal_output_buffers.pop(session_id, None)
    
    return {"status": "Terminal session terminated"} 