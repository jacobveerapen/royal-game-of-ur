import { useState, useCallback } from 'react'
import { GameState, Player, Position } from '../types/game'

// Initial game state
const initialGameState: GameState = {
  currentPlayer: 1, // Player 1 starts
  board: {}, // Empty board
  dice: [0, 0, 0, 0], // Four binary dice, initially all 0
  winner: null
}

// Hook for managing game state
export const useGameState = () => {
  const [gameState, setGameState] = useState<GameState>(initialGameState)
  
  // Roll dice and update game state
  const rollDice = useCallback((diceResults: number[]) => {
    setGameState(prevState => ({
      ...prevState,
      dice: diceResults
    }))
  }, [])
  
  // Calculate the total moves from dice results
  const getDiceTotal = useCallback(() => {
    return gameState.dice.reduce((sum, value) => sum + value, 0)
  }, [gameState.dice])
  
  // Handle piece movement
  const movePiece = useCallback((from: Position, to: Position) => {
    const fromKey = `${from[0]},${from[1]}`
    const toKey = `${to[0]},${to[1]}`
    
    setGameState(prevState => {
      const newBoard = { ...prevState.board }
      
      // Move the piece
      newBoard[toKey] = prevState.board[fromKey]
      delete newBoard[fromKey]
      
      // Check if the piece landed on a rosette (this would need to be implemented)
      // For now, we'll just switch players after each move
      
      return {
        ...prevState,
        board: newBoard,
        currentPlayer: prevState.currentPlayer === 1 ? 2 : 1,
      }
    })
  }, [])
  
  // Switch to the next player
  const switchPlayer = useCallback(() => {
    setGameState(prevState => ({
      ...prevState,
      currentPlayer: prevState.currentPlayer === 1 ? 2 : 1,
    }))
  }, [])
  
  // Get valid moves for the current player based on dice roll
  const getValidMoves = useCallback(() => {
    // This would implement the game rules for valid moves
    // For now, we'll return an empty array
    return []
  }, [gameState])
  
  // Reset the game to initial state
  const resetGame = useCallback(() => {
    setGameState(initialGameState)
  }, [])
  
  return {
    gameState,
    rollDice,
    getDiceTotal,
    movePiece,
    switchPlayer,
    getValidMoves,
    resetGame
  }
} 