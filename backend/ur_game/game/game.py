import random
from typing import List, Optional, Set
from .board import Board, Player, Piece

class Game:
    """
    Manages the game state and rules for the Royal Game of Ur.
    Handles turn management, dice rolling, and victory conditions.
    """
    def __init__(self):
        self.board = Board()
        self.current_player = Player.ONE
        self.dice_result = 0
        self.game_over = False
        self.winner: Optional[Player] = None

    def roll_dice(self) -> int:
        """
        Roll 4 binary dice (tetrahedral dice with values 0/1).
        Returns the sum of the dice (0-4).
        """
        self.dice_result = sum(random.randint(0, 1) for _ in range(4))
        return self.dice_result

    def get_valid_moves(self) -> Set[Piece]:
        """Returns a set of pieces that can be moved with the current dice roll."""
        if self.dice_result == 0:
            return set()

        valid_pieces = set()
        
        # Check pieces in hand
        for piece in self.board.pieces_in_hand[self.current_player]:
            if self.board.is_valid_move(piece, self.dice_result):
                valid_pieces.add(piece)
        
        # Check pieces on board
        for piece in self.board.pieces[self.current_player]:
            if not piece.completed and piece not in self.board.pieces_in_hand[self.current_player]:
                if self.board.is_valid_move(piece, self.dice_result):
                    valid_pieces.add(piece)
        
        return valid_pieces

    def make_move(self, piece: Piece) -> bool:
        """
        Make a move with the selected piece.
        Returns True if the player gets another turn (landed on rosette).
        """
        if piece.player != self.current_player:
            raise ValueError("Not your piece!")
        
        if piece not in self.get_valid_moves():
            raise ValueError("Invalid move!")

        landed_on_rosette = self.board.move_piece(piece, self.dice_result)
        
        # Check for victory
        if self._check_victory():
            self.game_over = True
            self.winner = self.current_player
            return False

        # Return True if player gets another turn
        return landed_on_rosette

    def _check_victory(self) -> bool:
        """Check if the current player has won."""
        return all(piece.completed for piece in self.board.pieces[self.current_player])

    def next_turn(self):
        """Switch to the next player's turn."""
        if self.game_over:
            return
        self.current_player = Player.TWO if self.current_player == Player.ONE else Player.ONE
        self.dice_result = 0

    def get_game_state(self) -> dict:
        """Return a dictionary containing the current game state."""
        return {
            "current_player": self.current_player.value,
            "dice_result": self.dice_result,
            "game_over": self.game_over,
            "winner": self.winner.value if self.winner else None,
            "board": str(self.board),
            "pieces_in_hand": {
                Player.ONE.value: len(self.board.pieces_in_hand[Player.ONE]),
                Player.TWO.value: len(self.board.pieces_in_hand[Player.TWO])
            },
            "completed_pieces": {
                Player.ONE.value: sum(1 for p in self.board.pieces[Player.ONE] if p.completed),
                Player.TWO.value: sum(1 for p in self.board.pieces[Player.TWO] if p.completed)
            }
        } 