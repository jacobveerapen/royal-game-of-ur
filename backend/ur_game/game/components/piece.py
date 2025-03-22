from typing import Optional, Tuple
from .player import Player

class Piece:
    """Represents a game piece."""
    def __init__(self, player: Player, piece_id: int):
        self.player = player
        self.piece_id = piece_id  # 1-7 for each player
        self.position: Optional[Tuple[int, int]] = None
        self.completed = False

    def __str__(self) -> str:
        return f"{self.player.value}{self.piece_id}" 