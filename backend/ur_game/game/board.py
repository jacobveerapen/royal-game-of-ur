from typing import Dict, List, Set, Tuple
from .components import Player, Piece, Square

class Board:
    """
    Represents the Royal Game of Ur board.
    
    Historical Board Layout (4x3 grid):
    
    P2 Start   Shared    P2 End
    🌺 [ ] [ ] [ ] [ ] [ ] 🌺 [ ]   Row 0
    [ ] [ ] [ ] 🌺 [ ] [ ] [ ] [ ]   Row 1
    🌺 [ ] [ ] [ ] [ ] [ ] 🌺 [ ]   Row 2
    P1 Start   Shared    P1 End
    
    Legend:
    🌺 = Rosette square (grants extra turn)
    [ ] = Normal square
    
    Square coordinates are (row, col) where:
    - row: 0 (top) to 2 (bottom)
    - col: 0 (left) to 7 (right)
    
    Path length for each player is 14 squares:
    - 4 squares in starting section
    - 8 squares in shared middle section
    - 2 squares in ending section
    
    Rosette squares at coordinates (5 total):
    - Player 1 start: (2, 0)
    - Player 2 start: (0, 0)
    - Shared middle: (1, 3)
    - Player 1 end: (2, 6)
    - Player 2 end: (0, 6)
    """
    def __init__(self):
        # Initialize the board layout
        self.squares: Dict[Tuple[int, int], Square] = {}
        self._initialize_board()
        
        # Player pieces (7 per player)
        self.pieces: Dict[Player, List[Piece]] = {
            Player.ONE: [Piece(Player.ONE, i) for i in range(1, 8)],
            Player.TWO: [Piece(Player.TWO, i) for i in range(1, 8)]
        }
        
        # Track pieces not yet on the board
        self.pieces_in_hand: Dict[Player, Set[Piece]] = {
            Player.ONE: set(self.pieces[Player.ONE]),
            Player.TWO: set(self.pieces[Player.TWO])
        }

    def _initialize_board(self):
        """Initialize the board layout with valid squares and rosettes."""
        # Define valid squares for each section
        p1_start = [(2, i) for i in range(4)]  # Player 1 start (bottom)
        p2_start = [(0, i) for i in range(4)]  # Player 2 start (top)
        shared_path = [(1, i) for i in range(8)]  # Shared middle path
        p1_end = [(2, 6), (2, 7)]  # Player 1 end (bottom)
        p2_end = [(0, 6), (0, 7)]  # Player 2 end (top)
        
        # Define rosette positions (matching the historical board)
        rosette_squares = [
            (2, 0),  # Player 1 start
            (0, 0),  # Player 2 start
            (1, 3),  # Shared middle
            (2, 6),  # Player 1 end (first square only)
            (0, 6)   # Player 2 end (first square only)
        ]
        
        # Create all squares
        for pos in p1_start + p2_start:
            self.squares[pos] = Square(pos, pos in rosette_squares, False)
        
        for pos in shared_path:
            self.squares[pos] = Square(pos, pos in rosette_squares, True)
            
        for pos in p1_end + p2_end:
            self.squares[pos] = Square(pos, pos in rosette_squares, False)

    def get_player_path(self, player: Player) -> List[Tuple[int, int]]:
        """
        Returns the path that pieces must follow for the given player.
        
        Path sequence (1-14):
        - Start section: positions 1, 2, 3, 4
        - Shared middle: positions 5, 6, 7, 8, 9, 10, 11, 12
        - End section: positions 13, 14
        
        From position 12 (middle row, rightmost):
        - Player 1 moves: (1,7) -> (2,7) -> (2,6)
        - Player 2 moves: (1,7) -> (0,7) -> (0,6)
        """
        if player == Player.ONE:
            return [
                # Start section (1,2,3,4)
                (2, 3), (2, 2), (2, 1), (2, 0),
                # Shared middle section (5,6,7,8,9,10,11,12)
                (1, 0), (1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7),
                # End section (13,14)
                (2, 7), (2, 6)
            ]
        else:  # Player.TWO
            return [
                # Start section (1,2,3,4)
                (0, 3), (0, 2), (0, 1), (0, 0),
                # Shared middle section (5,6,7,8,9,10,11,12)
                (1, 0), (1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7),
                # End section (13,14)
                (0, 7), (0, 6)
            ]

    def _is_in_player_section(self, player: Player, position: Tuple[int, int]) -> bool:
        """Check if a position is in a player's start or end section."""
        row, _ = position
        if player == Player.ONE:
            return row == 2  # Bottom row
        return row == 0  # Top row

    def is_valid_move(self, piece: Piece, steps: int) -> bool:
        """
        Check if moving the given piece by the specified number of steps is valid.
        
        Special rules:
        1. +1 point space:
           - Must land exactly on this space to score
           - Cannot move if the roll would take the piece beyond this space
        
        2. Capturing mechanics (middle row only):
           - Can capture opponent's pieces in the middle row
           - Cannot capture on the middle rosette (safe space)
           - Cannot move to middle rosette if occupied by opponent
           - Cannot land on own pieces anywhere
           - Cannot capture outside middle row (paths never intersect there)
        """
        if piece.completed:
            return False

        # Get the path for the piece's player
        path = self.get_player_path(piece.player)
        
        # If piece is not on board, it must enter from the start
        if piece in self.pieces_in_hand[piece.player]:
            if steps == 0:
                return False
            target_pos = path[steps - 1]
            target_square = self.squares[target_pos]
            
            # If target is occupied
            if target_square.piece:
                # In middle row, can capture opponent's piece (except on rosette)
                if target_pos[0] == 1:
                    return (target_square.piece.player != piece.player and 
                           not target_square.is_rosette)
                # Outside middle row, cannot land on any occupied square
                return False
            
            return True
            
        # If piece is on board, calculate its new position
        current_index = path.index(piece.position)
        new_index = current_index + steps
        
        # Special handling for scoring on the +1 point space (space 15)
        scoring_index = len(path)
        if new_index > scoring_index:
            return False
        if new_index == scoring_index:
            return True
            
        # For normal moves, check target square
        target_pos = path[new_index]
        target_square = self.squares[target_pos]
        
        # If target is occupied
        if target_square.piece:
            # In middle row, can capture opponent's piece (except on rosette)
            if target_pos[0] == 1:
                return (target_square.piece.player != piece.player and 
                       not target_square.is_rosette)
            # Outside middle row, cannot land on any occupied square
            return False
            
        return True

    def move_piece(self, piece: Piece, steps: int) -> bool:
        """
        Move a piece on the board. Returns True if the piece lands on a rosette
        during this move (not if it was already on a rosette).
        """
        if not self.is_valid_move(piece, steps):
            return False

        path = self.get_player_path(piece.player)
        
        # Remove piece from current position if it's on the board
        if piece.position:
            self.squares[piece.position].piece = None
        else:
            self.pieces_in_hand[piece.player].remove(piece)

        # Calculate new position
        current_index = -1 if piece.position is None else path.index(piece.position)
        new_index = current_index + steps

        # Check if piece reaches the +1 point space (space 15)
        if new_index == len(path):
            piece.completed = True
            piece.position = None
            return False

        # Move to new position
        new_pos = path[new_index]
        
        # Capture opponent's piece if present
        if self.squares[new_pos].piece:
            captured_piece = self.squares[new_pos].piece
            captured_piece.position = None
            self.pieces_in_hand[captured_piece.player].add(captured_piece)

        # Place piece in new position
        self.squares[new_pos].piece = piece
        piece.position = new_pos

        # Return True only if the piece lands on a rosette during this move
        return self.squares[new_pos].is_rosette

    def __str__(self) -> str:
        """
        Return a string representation of the board.
        Shows the H-shaped layout with rosettes marked as 🌺.
        """
        result = []
        # Add header
        result.append("   P2 Start   Shared    P2 End")
        
        # Add board rows
        for row in range(3):
            line = []
            for col in range(8):
                pos = (row, col)
                if pos in self.squares:
                    line.append(str(self.squares[pos]))
                else:
                    line.append("   ")
            result.append(" ".join(line))
            
            # Add row labels
            if row == 0:
                result[-1] += "   Top"
            elif row == 1:
                result[-1] += "   Middle"
            elif row == 2:
                result[-1] += "   Bottom"
        
        # Add footer
        result.append("   P1 Start   Shared    P1 End")
        return "\n".join(result) 