
import React, { createContext, useState, useContext, ReactNode } from 'react';

// Define the type for our board state
export type BoardCell = string | null;
export type BoardState = Array<Array<BoardCell>> | null;

// Define the shape of our context
interface BoardContextType {
  boardState: BoardState;
  setBoardState: (state: BoardState) => void;
}

// Create the context with default values
const BoardContext = createContext<BoardContextType>({
  boardState: null,
  setBoardState: () => {},
});

// Custom hook to use the board context
export const useBoardContext = () => useContext(BoardContext);

// Provider component
interface BoardProviderProps {
  children: ReactNode;
}

export const BoardProvider: React.FC<BoardProviderProps> = ({ children }) => {
  const [boardState, setBoardState] = useState<BoardState>(null);

  return (
    <BoardContext.Provider value={{ boardState, setBoardState }}>
      {children}
    </BoardContext.Provider>
  );
}; 