"""
State representation for the Royal Game of Ur.
Converts the game state into a format suitable for neural network input.
"""
import numpy as np
from backend.ur_game.game import Game
from backend.ur_game.game.board import Player, Piece

class StateRepresentation:
    """
    Converts the Royal Game of Ur game state into a format suitable for neural network input.
    """
    # Board dimensions
    ROWS = 3
    COLS = 8
    
    # Feature channels
    PLAYER_ONE_PIECES = 0  # Channel for player one pieces
    PLAYER_TWO_PIECES = 1  # Channel for player two pieces
    ROSETTES = 2           # Channel for rosette positions
    VALID_MOVES = 3        # Channel for valid moves with current dice roll
    DICE_ROLL = 4          # Channel for dice roll representation
    HAND_PIECES = 5        # Channel for pieces in hand
    COMPLETED_PIECES = 6   # Channel for completed pieces
    
    NUM_CHANNELS = 7       # Total number of feature channels

    @classmethod
    def get_state_shape(cls):
        """Returns the shape of the state representation."""
        return (cls.ROWS, cls.COLS, cls.NUM_CHANNELS)

    @classmethod
    def get_state(cls, game: Game, perspective_player: Player = None):
        """
        Converts the current game state into a tensor representation.
        
        Args:
            game: The Game object containing the current state.
            perspective_player: The player from whose perspective to represent the state.
                                If None, uses the current player.
                                
        Returns:
            A numpy array with shape (ROWS, COLS, NUM_CHANNELS) representing the state.
        """
        if perspective_player is None:
            perspective_player = game.current_player
            
        # Initialize state tensor with zeros
        state = np.zeros((cls.ROWS, cls.COLS, cls.NUM_CHANNELS), dtype=np.float32)
        
        # Mark rosette positions (channel 2)
        for pos, square in game.board.squares.items():
            if square.is_rosette:
                row, col = pos
                state[row, col, cls.ROSETTES] = 1.0
        
        # Mark player pieces on the board (channels 0 and 1)
        for player in [Player.ONE, Player.TWO]:
            channel = cls.PLAYER_ONE_PIECES if player == Player.ONE else cls.PLAYER_TWO_PIECES
            for piece in game.board.pieces[player]:
                if piece.position and not piece.completed:
                    row, col = piece.position
                    state[row, col, channel] = 1.0
        
        # Mark valid moves (channel 3)
        valid_moves = game.get_valid_moves()
        for piece in valid_moves:
            # For pieces in hand, mark their entry position
            if piece in game.board.pieces_in_hand[perspective_player]:
                path = game.board.get_player_path(perspective_player)
                if game.dice_result > 0 and game.dice_result <= len(path):
                    # Entry position is start + dice_roll - 1
                    target_pos = path[game.dice_result - 1]
                    row, col = target_pos
                    state[row, col, cls.VALID_MOVES] = 1.0
            # For pieces on the board, mark where they can move to
            else:
                path = game.board.get_player_path(perspective_player)
                current_index = path.index(piece.position)
                new_index = current_index + game.dice_result
                
                # Only mark if the new index is within the path length
                if new_index < len(path):
                    target_pos = path[new_index]
                    row, col = target_pos
                    state[row, col, cls.VALID_MOVES] = 1.0
        
        # Set dice roll (channel 4)
        # Normalize dice roll between 0 and 1 (0/4 to 4/4)
        dice_value = game.dice_result / 4.0
        state[:, :, cls.DICE_ROLL] = dice_value
        
        # Mark pieces in hand (channel 5)
        hands = {
            Player.ONE: len(game.board.pieces_in_hand[Player.ONE]) / 7.0,
            Player.TWO: len(game.board.pieces_in_hand[Player.TWO]) / 7.0
        }
        
        # Fill the hand pieces channel based on whose perspective we're using
        own_hand = hands[perspective_player]
        opponent = Player.TWO if perspective_player == Player.ONE else Player.ONE
        opponent_hand = hands[opponent]
        
        # First half of the board shows own hand pieces, second half shows opponent's
        state[:, :4, cls.HAND_PIECES] = own_hand
        state[:, 4:, cls.HAND_PIECES] = opponent_hand
        
        # Mark completed pieces (channel 6)
        completed = {
            Player.ONE: sum(1 for p in game.board.pieces[Player.ONE] if p.completed) / 7.0,
            Player.TWO: sum(1 for p in game.board.pieces[Player.TWO] if p.completed) / 7.0
        }
        
        # Fill the completed pieces channel based on whose perspective we're using
        own_completed = completed[perspective_player]
        opponent_completed = completed[opponent]
        
        # First half of the board shows own completed pieces, second half shows opponent's
        state[:, :4, cls.COMPLETED_PIECES] = own_completed
        state[:, 4:, cls.COMPLETED_PIECES] = opponent_completed
        
        return state

    @staticmethod
    def flip_player_perspective(state):
        """
        Flips the state representation to the opponent's perspective.
        This is used for self-play training to ensure the agent learns from both sides.
        
        Args:
            state: The state tensor from one player's perspective
            
        Returns:
            The state tensor from the opponent's perspective
        """
        flipped_state = np.copy(state)
        
        # Swap player channels
        player_one_channel = np.copy(state[:, :, StateRepresentation.PLAYER_ONE_PIECES])
        player_two_channel = np.copy(state[:, :, StateRepresentation.PLAYER_TWO_PIECES])
        
        flipped_state[:, :, StateRepresentation.PLAYER_ONE_PIECES] = player_two_channel
        flipped_state[:, :, StateRepresentation.PLAYER_TWO_PIECES] = player_one_channel
        
        # Flip the hand and completed pieces information
        # For the hand and completed pieces channels, we need to swap the first and second half of the board
        for channel in [StateRepresentation.HAND_PIECES, StateRepresentation.COMPLETED_PIECES]:
            first_half = np.copy(state[:, :4, channel])
            second_half = np.copy(state[:, 4:, channel]) 
            flipped_state[:, :4, channel] = second_half.reshape(first_half.shape)
            flipped_state[:, 4:, channel] = first_half.reshape(second_half.shape)
        
        return flipped_state 