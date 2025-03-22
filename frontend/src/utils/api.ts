import { GameState, Player } from '../types/game'

interface ApiGameState {
  current_player: number
  dice_result: number
  game_over: boolean
  winner: number | null
  board: Array<Array<number | null>>
  player1_pieces_in_hand: number
  player2_pieces_in_hand: number
  player1_completed: number
  player2_completed: number
  valid_moves: Array<[number, number]> | null
}

// Convert backend API response to frontend GameState
const mapApiResponseToGameState = (apiResponse: ApiGameState): GameState => {
  // Create a board object from the 2D array
  const board: { [key: string]: Player | null } = {}
  
  // Process the board data
  apiResponse.board.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell !== null) {
        // Cast the number to Player type (1 | 2)
        board[`${rowIndex},${colIndex}`] = cell as Player
      }
    })
  })
  
  return {
    currentPlayer: apiResponse.current_player as Player,
    board,
    dice: [
      // Convert dice_result into an array of binary values (0 or 1)
      // This is a simplification - in a real app you might get the actual dice values
      ...(Array(apiResponse.dice_result).fill(1)),
      ...(Array(4 - apiResponse.dice_result).fill(0))
    ],
    winner: apiResponse.winner as Player | null,
    piecesInHand: {
      1: apiResponse.player1_pieces_in_hand,
      2: apiResponse.player2_pieces_in_hand
    },
    completedPieces: {
      1: apiResponse.player1_completed,
      2: apiResponse.player2_completed
    },
    validMoves: apiResponse.valid_moves || []
  }
}

// API client for the Royal Game of Ur backend
export const api = {
  // Base URL for API requests
  baseUrl: 'http://localhost:8000/api',
  
  // Create a new game
  async createGame(): Promise<GameState> {
    try {
      const response = await fetch(`${this.baseUrl}/games`, {
        method: 'POST',
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`)
      }
      
      const data: ApiGameState = await response.json()
      return mapApiResponseToGameState(data)
    } catch (error) {
      console.error('Error creating game:', error)
      throw error
    }
  },
  
  // Get game state
  async getGameState(gameId: string): Promise<GameState> {
    try {
      const response = await fetch(`${this.baseUrl}/games/${gameId}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`)
      }
      
      const data: ApiGameState = await response.json()
      return mapApiResponseToGameState(data)
    } catch (error) {
      console.error('Error getting game state:', error)
      throw error
    }
  },
  
  // Roll dice
  async rollDice(gameId: string): Promise<GameState> {
    try {
      const response = await fetch(`${this.baseUrl}/games/${gameId}/roll`, {
        method: 'POST',
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`)
      }
      
      const data: ApiGameState = await response.json()
      return mapApiResponseToGameState(data)
    } catch (error) {
      console.error('Error rolling dice:', error)
      throw error
    }
  },
  
  // Move a piece
  async movePiece(gameId: string, pieceId: number, player: 1 | 2): Promise<GameState> {
    try {
      const response = await fetch(`${this.baseUrl}/games/${gameId}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          game_id: gameId,
          piece_id: pieceId,
          player
        }),
      })
      
      if (!response.ok) {
        // If move is invalid, API will return 400
        if (response.status === 400) {
          // This is not a critical error, just an invalid move
          console.log('Invalid move')
          throw new Error('Invalid move')
        }
        throw new Error(`HTTP error! Status: ${response.status}`)
      }
      
      const data: ApiGameState = await response.json()
      return mapApiResponseToGameState(data)
    } catch (error) {
      console.error('Error moving piece:', error)
      throw error
    }
  }
} 