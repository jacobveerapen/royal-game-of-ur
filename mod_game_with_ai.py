"""
Run the Royal Game of Ur with AI integration.
This script allows playing the game with an AI opponent using the trained RL agent.
"""
import argparse
import time
from backend.ur_game.game import Game
from backend.ur_game.game.board import Player
from rl_agent.dqn_agent import UrDQNAgent

def run_game_with_ai(model_path=None, ai_player=Player.TWO, verbose=True):
    """
    Run a game with an AI player.
    
    Args:
        model_path: Path to the trained model file. If None, uses a random agent.
        ai_player: Which player the AI should play as.
        verbose: Whether to print game state.
    """
    # Initialize game
    game = Game()
    
    # Initialize AI agent
    agent = UrDQNAgent(epsilon_start=0.0)  # No exploration during play
    if model_path:
        try:
            agent.load(model_path)
            if verbose:
                print(f"Loaded trained model from {model_path}")
        except Exception as e:
            if verbose:
                print(f"Failed to load model: {e}. Using untrained agent.")
    elif verbose:
        print("No model provided. Using random agent.")
    
    # Main game loop (similar to test_game.py but with AI integration)
    while not game.game_over:
        if verbose:
            print("\nRoyal Game of Ur")
            print("=" * 40)
            print(f"Current Player: {game.current_player.name}")
            print(f"\nPieces in hand - P1: {len(game.board.pieces_in_hand[Player.ONE])}, "
                  f"P2: {len(game.board.pieces_in_hand[Player.TWO])}")
            print(f"Completed pieces - P1: {sum(1 for p in game.board.pieces[Player.ONE] if p.completed)}, "
                  f"P2: {sum(1 for p in game.board.pieces[Player.TWO] if p.completed)}")
            print("\nBoard:")
            print(game.board)
        
        # Roll dice - only wait for input if it's human's turn
        if game.current_player == ai_player:
            if verbose:
                print("\nAI is rolling the dice...")
                time.sleep(1)  # Short delay to make AI turns more visible
        else:
            if verbose:
                print("\nRolling dice...")
        
        roll = game.roll_dice()
        if verbose:
            print(f"\nRolled: {roll}")
        
        if roll == 0:
            if verbose:
                if game.current_player != ai_player:
                    print("No moves possible with a roll of 0!")
                    time.sleep(1)  # Short delay
                else:
                    print("AI rolled 0. No moves possible!")
                    time.sleep(1)  # Short delay
            game.next_turn()
            continue
        
        # Get valid moves
        valid_moves = game.get_valid_moves()
        if not valid_moves:
            if verbose:
                if game.current_player != ai_player:
                    print("No valid moves available!")
                    time.sleep(1)  # Short delay
                else:
                    print("AI has no valid moves available!")
                    time.sleep(1)  # Short delay
            game.next_turn()
            continue
        
        # AI or human move
        if game.current_player == ai_player:
            # AI's turn
            if verbose:
                print("\nAI is thinking...")
                time.sleep(0.5)  # Short delay for better user experience
            
            selected_piece = agent.get_move(game)
            
            if verbose:
                status = "in hand" if selected_piece in game.board.pieces_in_hand[game.current_player] else f"at {selected_piece.position}"
                print(f"AI selected Piece {selected_piece.piece_id} ({status})")
                time.sleep(0.5)  # Short delay to show AI's move
        else:
            # Human's turn
            if verbose:
                print("\nAvailable pieces to move:")
                moves = list(valid_moves)
                for i, piece in enumerate(moves, 1):
                    status = "in hand" if piece in game.board.pieces_in_hand[game.current_player] else "on board"
                    print(f"{i}. Piece {piece.piece_id} ({status})")
                
                # Get player choice
                while True:
                    try:
                        choice = int(input("\nChoose a piece to move (enter number): ")) - 1
                        if 0 <= choice < len(moves):
                            break
                        print("Invalid choice, try again!")
                    except ValueError:
                        print("Please enter a number!")
                
                selected_piece = moves[choice]
            else:
                # In non-verbose mode, just pick the first valid piece
                selected_piece = list(valid_moves)[0]
        
        # Make the move
        try:
            extra_turn = game.make_move(selected_piece)
            if extra_turn and verbose:
                if game.current_player != ai_player:
                    print("\nLanded on a rosette! You get another turn!")
                    time.sleep(1)  # Short delay
                else:
                    print("\nAI landed on a rosette! AI gets another turn!")
                    time.sleep(1)  # Short delay
            else:
                game.next_turn()
        except ValueError as e:
            if verbose:
                if game.current_player != ai_player:
                    print(f"\nError: {e}")
                    time.sleep(1)  # Short delay
                else:
                    print(f"\nAI move error: {e}")
                    time.sleep(1)  # Short delay
    
    # Game over
    if verbose:
        print("\nGame Over!")
        print(f"Player {game.winner.name} wins!")
    
    return game.winner

def main():
    parser = argparse.ArgumentParser(description="Run the Royal Game of Ur with AI integration")
    parser.add_argument("--model", type=str, default=None, help="Path to the trained model file")
    parser.add_argument("--ai-player", type=int, choices=[1, 2], default=2, help="Which player the AI should play as (1 or 2)")
    parser.add_argument("--quiet", action="store_true", help="Run in quiet mode (no output)")
    
    args = parser.parse_args()
    ai_player = Player.ONE if args.ai_player == 1 else Player.TWO
    
    run_game_with_ai(args.model, ai_player, not args.quiet)

if __name__ == "__main__":
    main()