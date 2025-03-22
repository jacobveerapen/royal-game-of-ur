from typing import Optional, Tuple

class Square:
    """Represents a square on the game board."""
    def __init__(self, position: Tuple[int, int], is_rosette: bool = False, is_shared: bool = False):
        self.position = position  # (row, col)
        self.is_rosette = is_rosette
        self.is_shared = is_shared
        self.piece: Optional['Piece'] = None

    def __str__(self) -> str:
        if self.piece:
            return f"[{self.piece}]"
        return "🌺" if self.is_rosette else "[ ]"

# Avoid circular import by importing Piece type at runtime
from ..components.piece import Piece 