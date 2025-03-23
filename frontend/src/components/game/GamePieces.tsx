import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Position } from '../../types/game'

// Constants for positioning
const SQUARE_SIZE = 1.2
const SPACING = 0.2
const START_X = -7
const START_Z = -3.5
const PIECE_HEIGHT = 0.2

// Interface for the props
interface GamePiecesProps {
  boardState: Array<Array<string | null>> | null
}

// Parse the terminal board output to extract piece positions
const parseBoardState = (boardState: Array<Array<string | null>> | null): { player1Pieces: Position[], player2Pieces: Position[] } => {
  const player1Pieces: Position[] = []
  const player2Pieces: Position[] = []
  
  if (!boardState) return { player1Pieces, player2Pieces }
  
  // Iterate through the board and find pieces
  for (let row = 0; row < boardState.length; row++) {
    const rowData = boardState[row]
    if (!rowData) continue
    
    for (let col = 0; col < rowData.length; col++) {
      const cell = rowData[col]
      if (!cell) continue
      
      // Check for player pieces
      // Player 1 pieces start with 1 (e.g., "12")
      if (cell.startsWith('1')) {
        player1Pieces.push([row, col])
      }
      // Player 2 pieces start with 2 (e.g., "22")
      else if (cell.startsWith('2')) {
        player2Pieces.push([row, col])
      }
    }
  }
  
  return { player1Pieces, player2Pieces }
}

// Single piece component
const GamePiece = ({ position, color, floating = false }: { position: Position, color: string, floating?: boolean }) => {
  const meshRef = useRef<THREE.Mesh>(null)
  const initialY = 0.5 // Base height above the board
  const floatHeight = 0.15 // How high to float
  const floatSpeed = 1.5 // Speed of floating animation
  
  // Calculate the 3D position from the 2D board position
  const [x, z] = [
    START_X + position[1] * (SQUARE_SIZE + SPACING),
    START_Z + position[0] * (SQUARE_SIZE + SPACING)
  ]
  
  // Animate floating pieces
  useFrame(({ clock }) => {
    if (floating && meshRef.current) {
      meshRef.current.position.y = initialY + Math.sin(clock.getElapsedTime() * floatSpeed) * floatHeight
    }
  })
  
  return (
    <mesh 
      ref={meshRef} 
      position={[x, initialY, z]}
      castShadow
    >
      <cylinderGeometry args={[0.4, 0.4, PIECE_HEIGHT, 32]} />
      <meshStandardMaterial 
        color={color} 
        roughness={0.3} 
        metalness={0.4} 
        emissive={color === '#ffffff' ? '#222222' : '#000000'}
        emissiveIntensity={0.1}
      />
      {/* Add subtle edge highlight/bevel */}
      <mesh position={[0, PIECE_HEIGHT/2 - 0.01, 0]} scale={0.98}>
        <cylinderGeometry args={[0.4, 0.38, 0.03, 32]} />
        <meshStandardMaterial
          color={color === '#ffffff' ? '#eeeeee' : '#2a2a2a'}
          roughness={0.2}
          metalness={0.5}
        />
      </mesh>
    </mesh>
  )
}

export const GamePieces = ({ boardState }: GamePiecesProps) => {
  // Parse the board state to get player piece positions
  const { player1Pieces, player2Pieces } = parseBoardState(boardState)
  
  return (
    <group>
      {/* Player 1 pieces (black) */}
      {player1Pieces.map((position, index) => (
        <GamePiece 
          key={`p1-${index}-${position[0]}-${position[1]}`} 
          position={position} 
          color="#101010" 
          floating={true}
        />
      ))}
      
      {/* Player 2 pieces (white) */}
      {player2Pieces.map((position, index) => (
        <GamePiece 
          key={`p2-${index}-${position[0]}-${position[1]}`} 
          position={position} 
          color="#ffffff" 
          floating={true}
        />
      ))}

      {/* Testing multiple positions for Player 1 (black) pieces */}
      <GamePiece 
        key="test-p1-0-0" 
        position={[0, 0]} 
        color="#101010" 
        floating={true}
      />
      
      <GamePiece 
        key="test-p1-0-3" 
        position={[0, 3]} 
        color="#101010" 
        floating={true}
      />
      
      <GamePiece 
        key="test-p1-1-3" 
        position={[1, 3]} 
        color="#101010" 
        floating={true}
      />
      
      <GamePiece 
        key="test-p1-2-0" 
        position={[2, 0]} 
        color="#101010" 
        floating={true}
      />
      
      <GamePiece 
        key="test-p1-2-6" 
        position={[2, 6]} 
        color="#101010" 
        floating={true}
      />

      {/* Testing multiple positions for Player 2 (white) pieces */}
      <GamePiece 
        key="test-p2-0-0" 
        position={[0, 0]} 
        color="#ffffff" 
        floating={true}
      />
      
      <GamePiece 
        key="test-p2-0-6" 
        position={[0, 6]} 
        color="#ffffff" 
        floating={true}
      />
      
      <GamePiece 
        key="test-p2-1-0" 
        position={[1, 0]} 
        color="#ffffff" 
        floating={true}
      />
    </group>
  )
} 