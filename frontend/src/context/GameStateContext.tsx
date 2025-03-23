import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

// Define the game state structure
export interface GamePiece {
  player: 1 | 2;
  position: [number, number]; // Row, column position on the board
}

export interface GameState {
  currentPlayer: 1 | 2;
  pieces: GamePiece[];
  player1HandCount: number;
  player2HandCount: number;
  player1CompletedCount: number;
  player2CompletedCount: number;
}

// Define the context shape
interface GameStateContextType {
  gameState: GameState;
  updateGameState: (newState: Partial<GameState>) => void;
  updateBoardFromTerminal: (terminalOutput: string[]) => void;
}

// Default initial state
const initialGameState: GameState = {
  currentPlayer: 1,
  pieces: [],
  player1HandCount: 7,
  player2HandCount: 7,
  player1CompletedCount: 0,
  player2CompletedCount: 0,
};

// Create the context
const GameStateContext = createContext<GameStateContextType | undefined>(undefined);

// Provider component
export const GameStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [gameState, setGameState] = useState<GameState>(initialGameState);

  // Update the game state
  const updateGameState = useCallback((newState: Partial<GameState>) => {
    setGameState(prevState => ({ ...prevState, ...newState }));
  }, []);

  // Parse terminal output to extract board state
  const updateBoardFromTerminal = useCallback((terminalOutput: string[]) => {
    // Initialize a new pieces array
    const pieces: GamePiece[] = [];
    let player1Hand = 7;
    let player2Hand = 7;
    let player1Completed = 0;
    let player2Completed = 0;
    let currentPlayer: 1 | 2 = 1;
    
    // Start with a clean slate of pieces
    let foundBoard = false;
    let boardLines: string[] = [];
    let boardStartIndex = -1;
    
    // First, locate the board in the terminal output
    for (let i = terminalOutput.length - 1; i >= 0; i--) {
      const line = terminalOutput[i];
      
      // Look for "Current Player" line to determine whose turn it is
      if (line.includes("Current Player:")) {
        currentPlayer = line.includes("TWO") ? 2 : 1;
      }
      
      // Look for pieces in hand counts
      if (line.includes("Pieces in hand")) {
        const match = line.match(/P1:\s*(\d+),\s*P2:\s*(\d+)/);
        if (match) {
          player1Hand = parseInt(match[1]);
          player2Hand = parseInt(match[2]);
        }
      }
      
      // Look for completed pieces counts
      if (line.includes("Completed pieces")) {
        const match = line.match(/P1:\s*(\d+),\s*P2:\s*(\d+)/);
        if (match) {
          player1Completed = parseInt(match[1]);
          player2Completed = parseInt(match[2]);
        }
      }
      
      // Mark the start of the board
      if (line.includes("Board:")) {
        foundBoard = true;
        boardStartIndex = i;
        continue;
      }
      
      // Collect board lines
      if (foundBoard && i > boardStartIndex) {
        boardLines.unshift(line); // Add to start of array to maintain order
        
        // Stop collecting after we have enough lines
        if (boardLines.length >= 8) {
          break;
        }
      }
    }
    
    // Now parse the board representation
    if (boardLines.length >= 5) {
      // Find the rows with actual piece data (looking for flower symbols or brackets)
      const rows = boardLines.filter(line => 
        line.includes('🌺') || 
        line.includes('[') || 
        (line.includes('Top') || line.includes('Middle') || line.includes('Bottom'))
      );
      
      // Extract and parse rows
      for (let i = 0; i < rows.length; i++) {
        const line = rows[i];
        
        // Determine which row we're on
        let rowIndex = -1;
        if (line.includes('Top')) rowIndex = 0;
        else if (line.includes('Middle')) rowIndex = 1;
        else if (line.includes('Bottom')) rowIndex = 2;
        
        // If we identified a row with pieces, parse it
        if (rowIndex >= 0) {
          parseRowForPieces(line, rowIndex, pieces);
        }
      }
    }
    
    // Update the game state
    setGameState({
      currentPlayer,
      pieces,
      player1HandCount: player1Hand,
      player2HandCount: player2Hand,
      player1CompletedCount: player1Completed,
      player2CompletedCount: player2Completed,
    });
  }, []);
  
  // Helper function to parse a row of the board for pieces
  function parseRowForPieces(rowText: string, rowIndex: number, pieces: GamePiece[]) {
    console.log(`Parsing row ${rowIndex}: ${rowText}`);
    
    // Update the regex to match the format shown in the terminal output
    // Format example: 🌺 [24] [ ] [ ]         🌺 [ ]   Top
    const pieceMatches = [...rowText.matchAll(/\[(\d+)\]/g)];
    
    // Debug: Log the matches found
    console.log(`Found ${pieceMatches.length} piece matches in row ${rowIndex}`);
    pieceMatches.forEach(match => console.log(`Match at index ${match.index}: ${match[1]}`));
    
    if (pieceMatches.length === 0) {
      // Look for filled squares with any character inside brackets
      const filledSquares = [...rowText.matchAll(/\[([^\s\[\]])\]/g)];
      console.log(`Found ${filledSquares.length} filled squares in row ${rowIndex}`);
      
      for (const match of filledSquares) {
        if (match.index !== undefined) {
          // To calculate the column, find all bracket pairs up to this index
          // This is more accurate than using a fixed division
          const textUpToMatch = rowText.substring(0, match.index);
          const openBracketsBeforeMatch = (textUpToMatch.match(/\[/g) || []).length;
          
          // Column position is based on the number of open brackets before this one
          const columnIndex = openBracketsBeforeMatch - 1;
          
          // Determine the player based on the row
          let player: 1 | 2;
          
          if (rowIndex === 0) {
            // Top row - Player 2
            player = 2;
          } else if (rowIndex === 2) {
            // Bottom row - Player 1
            player = 1;
          } else {
            // Middle row - determine by position
            player = columnIndex < 4 ? 1 : 2;
          }
          
          // Add the piece to our collection
          pieces.push({
            player,
            position: [rowIndex, columnIndex]
          });
          
          console.log(`Added piece for player ${player} at position [${rowIndex}, ${columnIndex}]`);
        }
      }
    } else {
      // Process pieces with numeric IDs in brackets like [24]
      for (const match of pieceMatches) {
        if (match.index !== undefined) {
          // Calculate more accurately by counting brackets
          const textUpToMatch = rowText.substring(0, match.index);
          const openBracketsBeforeMatch = (textUpToMatch.match(/\[/g) || []).length;
          
          // Column position is based on the number of open brackets before this one
          const columnIndex = openBracketsBeforeMatch - 1;
          
          // For the player, use the first digit or infer from row position
          let player: 1 | 2;
          
          // Try to determine player from piece number
          const pieceNumber = parseInt(match[1]);
          if (pieceNumber >= 11 && pieceNumber <= 17) {
            player = 1; // Player 1 pieces are 11-17
          } else if (pieceNumber >= 21 && pieceNumber <= 27) {
            player = 2; // Player 2 pieces are 21-27
          } else {
            // Fall back to row-based determination
            player = rowIndex === 0 ? 2 : 
                     rowIndex === 2 ? 1 : 
                     columnIndex < 4 ? 1 : 2;
          }
          
          pieces.push({
            player,
            position: [rowIndex, columnIndex]
          });
          
          console.log(`Added piece ${pieceNumber} for player ${player} at position [${rowIndex}, ${columnIndex}]`);
        }
      }
    }
  }

  return (
    <GameStateContext.Provider value={{ gameState, updateGameState, updateBoardFromTerminal }}>
      {children}
    </GameStateContext.Provider>
  );
};

// Custom hook to use the game state
export const useGameState = () => {
  const context = useContext(GameStateContext);
  if (context === undefined) {
    throw new Error('useGameState must be used within a GameStateProvider');
  }
  return context;
}; 