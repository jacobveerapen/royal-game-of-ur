import pytest
from ..board import Board
from ..components import Player, Piece

def test_piece_movement_to_point_space():
    """Test the mechanics of moving to and scoring on the +1 point space."""
    board = Board()
    piece = board.pieces[Player.ONE][0]  # Get first piece for Player 1
    
    # Setup: Move piece to position 14 (second to last space)
    piece.position = (2, 6)  # The rosette square in P1's end section
    board.squares[(2, 6)].piece = piece
    board.pieces_in_hand[Player.ONE].remove(piece)
    
    # Test 1: Cannot move 2 spaces from position 14 (would go beyond +1 point space)
    assert not board.is_valid_move(piece, 2)
    
    # Test 2: Can move 1 space to reach +1 point space exactly
    assert board.is_valid_move(piece, 1)
    board.move_piece(piece, 1)
    assert piece.completed
    assert piece.position is None  # Piece should be removed from board after scoring
    
def test_piece_movement_from_shared_to_end():
    """Test the movement pattern from shared section to end section."""
    board = Board()
    p1_piece = board.pieces[Player.ONE][0]
    p2_piece = board.pieces[Player.TWO][0]
    
    # Setup: Move pieces to position 12 (end of shared section)
    p1_piece.position = (1, 7)
    p2_piece.position = (1, 7)
    board.squares[(1, 7)].piece = p1_piece
    board.pieces_in_hand[Player.ONE].remove(p1_piece)
    
    # Test Player 1 movement pattern
    board.move_piece(p1_piece, 1)  # Move one space
    assert p1_piece.position == (2, 7)  # Should move to bottom row
    
    # Reset and test Player 2 movement pattern
    board.squares[(1, 7)].piece = p2_piece
    board.pieces_in_hand[Player.TWO].remove(p2_piece)
    board.move_piece(p2_piece, 1)  # Move one space
    assert p2_piece.position == (0, 7)  # Should move to top row

def test_scoring_from_different_positions():
    """Test scoring when landing exactly on +1 point space from different positions."""
    board = Board()
    piece = board.pieces[Player.ONE][0]
    
    # Test 1: Score from position 12 with a roll of 3
    piece.position = (1, 7)  # Position 12
    board.squares[(1, 7)].piece = piece
    board.pieces_in_hand[Player.ONE].remove(piece)
    
    assert board.is_valid_move(piece, 2)  # Can move 2 spaces to position 14 (rosette)
    assert board.is_valid_move(piece, 3)  # Can move 3 spaces to reach +1 point space
    board.move_piece(piece, 3)
    assert piece.completed
    
    # Test 2: Score from position 13 with a roll of 2
    piece = board.pieces[Player.ONE][1]  # Use a different piece
    piece.position = (2, 7)  # Position 13
    board.squares[(2, 7)].piece = piece
    board.pieces_in_hand[Player.ONE].remove(piece)
    
    assert not board.is_valid_move(piece, 3)  # Can't move 3 spaces (too far)
    assert board.is_valid_move(piece, 2)  # Can move 2 spaces to reach +1 point space
    board.move_piece(piece, 2)
    assert piece.completed
    
    # Test 3: From position 14 (rosette)
    piece = board.pieces[Player.ONE][2]  # Use another piece
    piece.position = (2, 6)  # Position 14 (rosette)
    board.squares[(2, 6)].piece = piece
    board.pieces_in_hand[Player.ONE].remove(piece)
    
    assert not board.is_valid_move(piece, 2)  # Can't move 2 spaces (too far)
    assert board.is_valid_move(piece, 1)  # Can move 1 space to reach +1 point space
    board.move_piece(piece, 1)
    assert piece.completed

def test_rosette_mechanics():
    """Test that rosette mechanics work correctly in combination with scoring."""
    board = Board()
    piece = board.pieces[Player.ONE][0]
    
    # Move piece to the rosette square in end section
    piece.position = (2, 6)  # Position 14 (rosette)
    board.squares[(2, 6)].piece = piece
    board.pieces_in_hand[Player.ONE].remove(piece)
    
    # Test that landing on rosette from previous move doesn't affect scoring
    assert board.is_valid_move(piece, 1)  # Can move to +1 point space
    extra_turn = board.move_piece(piece, 1)
    assert not extra_turn  # Should not get extra turn when scoring
    assert piece.completed  # Should be completed
    
def test_capturing_mechanics():
    """Test the capturing mechanics in the middle row."""
    board = Board()
    p1_piece = board.pieces[Player.ONE][0]
    p2_piece = board.pieces[Player.TWO][0]
    
    # Test 1: Can capture in middle row
    p2_piece.position = (1, 2)  # Place P2's piece in middle row
    board.squares[(1, 2)].piece = p2_piece
    board.pieces_in_hand[Player.TWO].remove(p2_piece)
    
    p1_piece.position = (1, 0)  # Place P1's piece two spaces away
    board.squares[(1, 0)].piece = p1_piece
    board.pieces_in_hand[Player.ONE].remove(p1_piece)
    
    # P1 should be able to capture P2's piece
    assert board.is_valid_move(p1_piece, 2)
    board.move_piece(p1_piece, 2)
    assert p1_piece.position == (1, 2)  # P1's piece moved to the spot
    assert p2_piece.position is None  # P2's piece was captured
    assert p2_piece in board.pieces_in_hand[Player.TWO]  # P2's piece returned to hand
    
def test_middle_rosette_safe_space():
    """Test that the middle rosette acts as a safe space."""
    board = Board()
    p1_piece = board.pieces[Player.ONE][0]
    p2_piece = board.pieces[Player.TWO][0]
    
    # Place P2's piece on middle rosette
    p2_piece.position = (1, 3)  # Middle rosette position
    board.squares[(1, 3)].piece = p2_piece
    board.pieces_in_hand[Player.TWO].remove(p2_piece)
    
    # Place P1's piece three spaces away
    p1_piece.position = (1, 0)
    board.squares[(1, 0)].piece = p1_piece
    board.pieces_in_hand[Player.ONE].remove(p1_piece)
    
    # P1 should not be able to move to the rosette
    assert not board.is_valid_move(p1_piece, 3)
    
def test_no_capture_outside_middle():
    """Test that capturing is not allowed outside the middle row."""
    board = Board()
    p1_piece = board.pieces[Player.ONE][0]
    p2_piece = board.pieces[Player.TWO][0]
    
    # Try to place pieces in their own start sections
    p1_piece.position = (2, 0)  # P1's start section
    board.squares[(2, 0)].piece = p1_piece
    board.pieces_in_hand[Player.ONE].remove(p1_piece)
    
    p2_piece.position = (0, 0)  # P2's start section
    board.squares[(0, 0)].piece = p2_piece
    board.pieces_in_hand[Player.TWO].remove(p2_piece)
    
    # Verify that pieces are in their correct sections
    assert p1_piece.position[0] == 2  # P1 in bottom row
    assert p2_piece.position[0] == 0  # P2 in top row
    
    # Verify that the paths never intersect outside middle row
    p1_path = board.get_player_path(Player.ONE)
    p2_path = board.get_player_path(Player.TWO)
    
    # Check that paths only share squares in middle row
    shared_squares = set(p1_path) & set(p2_path)
    assert all(pos[0] == 1 for pos in shared_squares), "Paths should only intersect in middle row"
    
    # Verify no pieces can move to opponent's sections
    for pos in p1_path:
        if pos[0] == 0:  # top row (P2's section)
            assert False, "P1's path should never enter P2's section"
    
    for pos in p2_path:
        if pos[0] == 2:  # bottom row (P1's section)
            assert False, "P2's path should never enter P1's section"

if __name__ == "__main__":
    pytest.main([__file__]) 