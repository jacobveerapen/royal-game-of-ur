import React from 'react'
import * as THREE from 'three'
import { useGameState } from '../../hooks/useGameState'
import { Position, Player } from '../../types/game'

// Simple game piece component
const GamePiece = ({ player, position }: { player: Player, position: [number, number, number] }) => {
  console.log(`Rendering piece for player ${player} at position`, position);
  
  return (
    <mesh position={position}>
      <cylinderGeometry args={[0.4, 0.4, 0.2, 32]} />
      <meshStandardMaterial
        color={player === 1 ? '#8b0000' : '#00008b'}
        roughness={0.5}
        metalness={0.5}
      />
    </mesh>
  );
};

// Simple square/tile component
const GameSquare = ({ position, isRosette, onClick }: { 
  position: [number, number, number], 
  isRosette: boolean,
  onClick: () => void
}) => {
  return (
    <mesh position={position} onClick={onClick}>
      <boxGeometry args={[1, 0.1, 1]} />
      <meshStandardMaterial 
        color={isRosette ? '#ffd700' : '#f5f5dc'} 
        roughness={0.7}
      />
    </mesh>
  );
};

// Constants for board layout
const SQUARE_SIZE = 1.2;
const SPACING = 0.2;
const START_X = -7;
const START_Z = -3.5;

// Define rosette positions
const ROSETTES: Position[] = [
  [0, 0], // P2 start rosette
  [0, 6], // P2 end rosette
  [1, 3], // Middle rosette
  [2, 0], // P1 start rosette
  [2, 6]  // P1 end rosette
];

// Define valid square positions - simplified for testing
const VALID_SQUARES: Position[] = [
  // Top row (player 2)
  [0, 0], [0, 1], [0, 2], [0, 3], 
  // Middle row
  [1, 0], [1, 1], [1, 2], [1, 3], 
  // Bottom row (player 1)
  [2, 0], [2, 1], [2, 2], [2, 3], 
];

// Convert board coordinates to 3D position
const boardToWorldPosition = (position: Position): [number, number, number] => {
  return [
    START_X + position[1] * (SQUARE_SIZE + SPACING),
    0.1, // Just slightly above the table
    START_Z + position[0] * (SQUARE_SIZE + SPACING)
  ];
};

// Main simple game board component
export const SimpleGameBoard = () => {
  console.log("Rendering SimpleGameBoard component");
  const { gameState, selectPiece, movePiece, isValidMove } = useGameState();
  
  console.log("Current game state:", gameState);
  
  // Check if a position is a rosette
  const isRosette = (pos: Position): boolean => {
    return ROSETTES.some(([row, col]) => row === pos[0] && col === pos[1]);
  };
  
  // Handle square click
  const handleSquareClick = (position: Position) => {
    console.log("Square clicked at position:", position);
    
    // If the position is a valid move and we have a selected piece, move to this position
    if (isValidMove(position)) {
      console.log("Moving piece to valid position:", position);
      movePiece(position);
    } else {
      console.log("Cannot move to this position");
    }
  };
  
  // Render the board tiles/squares
  const renderSquares = () => {
    return VALID_SQUARES.map(([row, col]) => {
      const position = boardToWorldPosition([row, col]);
      const isRosetteTile = isRosette([row, col]);
      
      return (
        <GameSquare 
          key={`square-${row}-${col}`} 
          position={position} 
          isRosette={isRosetteTile} 
          onClick={() => handleSquareClick([row, col])}
        />
      );
    });
  };
  
  // Render the game pieces
  const renderPieces = () => {
    const pieces: React.ReactElement[] = [];
    
    // Add pieces from the board
    if (gameState && gameState.board) {
      Object.entries(gameState.board).forEach(([key, player]) => {
        if (player) {
          const [row, col] = key.split(',').map(Number) as [number, number];
          const position = boardToWorldPosition([row, col]);
          
          pieces.push(
            <GamePiece 
              key={`piece-${key}`}
              player={player}
              position={position}
            />
          );
        }
      });
    }
    
    return pieces;
  };
  
  // Render the valid move highlights
  const renderValidMoveHighlights = () => {
    if (!gameState.validMoves || !gameState.validMoves.length) return null;
    
    return gameState.validMoves.map((position, index) => {
      // Skip the special "completion" position
      if (position[0] === -1 && position[1] === -1) return null;
      
      const worldPos = boardToWorldPosition(position);
      
      return (
        <mesh 
          key={`highlight-${index}`}
          position={[worldPos[0], worldPos[1] + 0.05, worldPos[2]]}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial 
            color="#00ff00" 
            transparent={true} 
            opacity={0.3} 
            side={THREE.DoubleSide}
          />
        </mesh>
      );
    });
  };
  
  return (
    <group>
      {/* Render the board squares/tiles */}
      {renderSquares()}
      
      {/* Render the game pieces */}
      {renderPieces()}
      
      {/* Render valid move highlights */}
      {renderValidMoveHighlights()}
    </group>
  );
}; 