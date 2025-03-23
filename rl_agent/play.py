"""
Play the Royal Game of Ur against a trained reinforcement learning agent.
"""
import argparse
import os
import random
import numpy as np
import tensorflow as tf
import time

from backend.ur_game.game import Game
from backend.ur_game.game.board import Player, Piece
from rl_agent.dqn_agent import UrDQNAgent
from rl_agent.state_representation import StateRepresentation

def clear_screen():
    """Clear the terminal screen."""
    os.system('cls' if os.name == 'nt' else 'clear')

def get_human_choice(valid_pieces, game):
    """
    Get the player's choice of piece to move.
    
    Args:
        valid_pieces: List of valid pieces that can be moved.
        game: The current game state.
        
    Returns:
        The selected piece.
    """
    print("\nAvailable pieces to move:")
    for i, piece in enumerate(valid_pieces, 1):
        status = "in hand" if piece in game.board.pieces_in_hand[game.current_player] else f"at {piece.position}"
        print(f"{i}. Piece {piece.piece_id} ({status})")
    
    while True:
        try:
            choice = input("\nChoose a piece to move (enter number): ")
            choice_idx = int(choice) - 1
            if 0 <= choice_idx < len(valid_pieces):
                return valid_pieces[choice_idx]
            print("Invalid choice, try again!")
        except ValueError:
            print("Please enter a number!")

def play_game(model_path=None, player_first=True, ai_delay=1.0):
    """
    Play a game against the trained RL agent.
    
    Args:
        model_path: Path to the trained model file. If None, uses a random agent.
        player_first: Whether the human player goes first (Player.ONE).
        ai_delay: Delay in seconds for AI moves to make them visible (0 for instant moves)
    """
    # Initialize agent
    agent = UrDQNAgent(epsilon_start=0.0)  # No exploration during play
    
    if model_path:
        try:
            agent.load(model_path)
            print(f"Loaded trained model from {model_path}")
        except:
            print(f"Failed to load model from {model_path}. Using untrained agent.")
    else:
        print("No model provided. Using untrained agent.")
    
    # Initialize game
    game = Game()
    
    # Assign player numbers
    human_player = Player.ONE if player_first else Player.TWO
    agent_player = Player.TWO if player_first else Player.ONE
    
    print("\n======== Welcome to the Royal Game of Ur ========")
    print("You are playing against a reinforcement learning agent.")
    print(f"You are Player {'ONE (bottom)' if human_player == Player.ONE else 'TWO (top)'}")
    print("Rosettes (🌺) grant an extra turn.")
    print("Capture opponent pieces by landing on them in the middle row.")
    print("First player to move all 7 pieces off the board wins!")
    print("===================================================\n")
    input("Press Enter to start the game...")
    
    # Main game loop
    while not game.game_over:
        # Clear screen and show current state
        clear_screen()
        print("\nRoyal Game of Ur")
        print("=" * 40)
        print(f"Current Player: {game.current_player.name}")
        print(f"\nPieces in hand - P1: {len(game.board.pieces_in_hand[Player.ONE])}, "
              f"P2: {len(game.board.pieces_in_hand[Player.TWO])}")
        print(f"Completed pieces - P1: {sum(1 for p in game.board.pieces[Player.ONE] if p.completed)}, "
              f"P2: {sum(1 for p in game.board.pieces[Player.TWO] if p.completed)}")
        print("\nBoard:")
        print(game.board)
        
        # Roll dice - different for human and AI
        if game.current_player == human_player:
            input("\nPress Enter to roll dice...")
            roll = game.roll_dice()
            print(f"\nYou rolled: {roll}")
        else:
            # AI's turn - auto roll
            print("\nAI is rolling...")
            time.sleep(ai_delay)  # Small delay for visibility
            roll = game.roll_dice()
            print(f"AI rolled: {roll}")
        
        if roll == 0:
            print("No moves possible with a roll of 0!")
            if game.current_player == human_player:
                input("\nPress Enter to continue...")
            else:
                time.sleep(ai_delay)  # Small delay for visibility
            game.next_turn()
            continue
        
        # Get valid moves
        valid_moves = game.get_valid_moves()
        if not valid_moves:
            print("No valid moves available!")
            if game.current_player == human_player:
                input("\nPress Enter to continue...")
            else:
                time.sleep(ai_delay)  # Small delay for visibility
            game.next_turn()
            continue
        
        # Human player's or agent's turn
        if game.current_player == human_player:
            # Human player's turn
            selected_piece = get_human_choice(list(valid_moves), game)
        else:
            # Agent's turn
            print("\nAI is thinking...")
            time.sleep(ai_delay)  # Small delay for visibility
            selected_piece = agent.get_move(game)
            status = "in hand" if selected_piece in game.board.pieces_in_hand[game.current_player] else f"at {selected_piece.position}"
            print(f"AI selected Piece {selected_piece.piece_id} ({status})")
            time.sleep(ai_delay)  # Small delay so player can see the move
        
        # Make the move
        extra_turn = game.make_move(selected_piece)
        if extra_turn:
            print("\nLanded on a rosette! Extra turn!")
            if game.current_player == human_player:
                input("Press Enter to continue...")
            else:
                time.sleep(ai_delay)  # Small delay for visibility
        else:
            game.next_turn()
    
    # Game over
    clear_screen()
    print("\nFinal Board:")
    print(game.board)
    print("\n===== Game Over! =====")
    print(f"Player {game.winner.name} wins!")
    
    if game.winner == human_player:
        print("\nCongratulations! You won against the AI!")
    else:
        print("\nThe AI won this time. Better luck next time!")
    
    # Ask to play again
    play_again = input("\nPlay again? (y/n): ").lower().strip()
    if play_again.startswith('y'):
        play_game(model_path, player_first, ai_delay)

def main():
    """Main function to parse arguments and start the game."""
    parser = argparse.ArgumentParser(description="Play Royal Game of Ur against a trained RL agent")
    parser.add_argument("--model", type=str, default=None, help="Path to the trained model file")
    parser.add_argument("--ai-first", action="store_true", help="Let the AI play first")
    parser.add_argument("--ai-delay", type=float, default=1.0, 
                      help="Delay in seconds for AI moves (0 for instant moves)")
    
    args = parser.parse_args()
    play_game(args.model, not args.ai_first, args.ai_delay)

if __name__ == "__main__":
    main() 