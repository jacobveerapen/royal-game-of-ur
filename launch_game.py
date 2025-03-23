#!/usr/bin/env python3
"""
Launcher for the Royal Game of Ur with options to play against a human or AI.
"""
import os
import sys
import argparse
from backend.ur_game.game import Game
from backend.ur_game.game.board import Player, Piece

def clear_screen():
    """Clear the terminal screen."""
    os.system('cls' if os.name == 'nt' else 'clear')

def get_model_path():
    """Find a valid model path in the models directory."""
    default_path = "models/ur_dqn_model_final.h5"
    
    if os.path.exists(default_path):
        return default_path
    
    # Try to find any model file
    if os.path.exists("models"):
        model_files = [f for f in os.listdir("models") if f.endswith(".h5")]
        if model_files:
            return os.path.join("models", model_files[0])
    
    return None

def print_banner():
    """Print a welcome banner."""
    print("\n" + "=" * 50)
    print("           THE ROYAL GAME OF UR")
    print("=" * 50)
    print("\nOne of humanity's oldest board games, dating back to ancient Mesopotamia.")
    print("Roll the dice, move your pieces, and be the first to get all 7 pieces off the board!\n")

def main():
    """Main function to launch the game with different modes."""
    parser = argparse.ArgumentParser(description="Launch the Royal Game of Ur")
    parser.add_argument("--skip-menu", action="store_true", help="Skip the menu and go straight to two-player mode")
    args = parser.parse_args()
    
    # If skip-menu is specified, launch the regular two-player game
    if args.skip_menu:
        from backend.ur_game.game.test_game import main as play_human_game
        play_human_game()
        return
    
    clear_screen()
    print_banner()
    
    print("Choose your game mode:\n")
    print("1. Play against another human")
    print("2. Play against AI")
    print("3. Exit")
    
    while True:
        try:
            choice = input("\nEnter your choice (1-3): ")
            
            if choice == '1':
                # Launch the regular game
                clear_screen()
                from backend.ur_game.game.test_game import main as play_human_game
                play_human_game()
                break
                
            elif choice == '2':
                # Find an AI model
                model_path = get_model_path()
                
                if not model_path:
                    print("\nError: No trained AI model found.")
                    print("Please train a model first or make sure it's in the 'models' directory.")
                    input("\nPress Enter to return to the menu...")
                    main()  # Restart the menu
                    return
                
                # Set AI delay (0.5 seconds is a good default)
                ai_delay = 0.5
                try:
                    delay_input = input("\nEnter AI move delay in seconds (0-2, default 0.5): ")
                    if delay_input.strip():
                        ai_delay = float(delay_input)
                        ai_delay = max(0, min(2, ai_delay))  # Clamp between 0 and 2
                except ValueError:
                    print("Invalid delay, using default (0.5 seconds).")
                
                # Launch the AI game
                clear_screen()
                from rl_agent.play import play_game as play_ai_game
                play_ai_game(model_path=model_path, player_first=True, ai_delay=ai_delay)
                break
                
            elif choice == '3':
                print("\nExiting game. Goodbye!")
                sys.exit(0)
                
            else:
                print("Invalid choice. Please enter 1, 2, or 3.")
                
        except KeyboardInterrupt:
            print("\n\nExiting game. Goodbye!")
            sys.exit(0)
            
        except Exception as e:
            print(f"\nAn error occurred: {e}")
            input("\nPress Enter to try again...")

if __name__ == "__main__":
    main() 