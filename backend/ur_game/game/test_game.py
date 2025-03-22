from .game import Game
from .board import Player, Piece

def main():
    """Run a simple text-based version of the Royal Game of Ur."""
    game = Game()
    
    while not game.game_over:
        # Clear screen (you can uncomment this in a real terminal)
        # print("\033[H\033[J")
        
        # Print game state
        print("\nRoyal Game of Ur")
        print("=" * 40)
        print(f"Current Player: {game.current_player.name}")
        print(f"\nPieces in hand - P1: {len(game.board.pieces_in_hand[Player.ONE])}, "
              f"P2: {len(game.board.pieces_in_hand[Player.TWO])}")
        print(f"Completed pieces - P1: {sum(1 for p in game.board.pieces[Player.ONE] if p.completed)}, "
              f"P2: {sum(1 for p in game.board.pieces[Player.TWO] if p.completed)}")
        print("\nBoard:")
        print(game.board)
        
        # Roll dice
        input("\nPress Enter to roll dice...")
        roll = game.roll_dice()
        print(f"\nYou rolled: {roll}")
        
        if roll == 0:
            print("No moves possible with a roll of 0!")
            input("\nPress Enter to continue...")
            game.next_turn()
            continue
        
        # Get valid moves
        valid_moves = game.get_valid_moves()
        if not valid_moves:
            print("No valid moves available!")
            input("\nPress Enter to continue...")
            game.next_turn()
            continue
        
        # Show available pieces to move
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
        
        # Make the move
        try:
            extra_turn = game.make_move(moves[choice])
            if extra_turn:
                print("\nLanded on a rosette! You get another turn!")
                input("Press Enter to continue...")
            else:
                game.next_turn()
        except ValueError as e:
            print(f"\nError: {e}")
            input("Press Enter to continue...")
    
    # Game over
    print("\nGame Over!")
    print(f"Player {game.winner.name} wins!")

if __name__ == "__main__":
    main() 