from backend.ur_game.game import Game

def main():
    # Create a new game instance
    game = Game()
    
    print("\nRoyal Game of Ur - Current Board State")
    print("=" * 40)
    print("\nBoard Layout:")
    print(game.board)
    
    print("\nLegend:")
    print("[*] = Rosette square")
    print("[ ] = Normal square")
    print("[1X] = Player 1's piece (where X is piece number)")
    print("[2X] = Player 2's piece (where X is piece number)")
    
    print("\nGame Status:")
    print(f"Current Player: Player {game.current_player.value}")
    print(f"Pieces in hand - P1: {len(game.board.pieces_in_hand[game.current_player])}, "
          f"P2: {len(game.board.pieces_in_hand[game.current_player])}")

if __name__ == "__main__":
    main() 