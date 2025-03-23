import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { Position } from '../../types/game';

// Constants for positioning - match the ones in Board.tsx and GamePieces.tsx
const SQUARE_SIZE = 1.2;
const SPACING = 0.2;
const START_X = -7;
const START_Z = -3.5;
const PIECE_HEIGHT = 0.2;

// A simple visual axis helper to help visualize coordinates
const AxisHelper: React.FC = () => {
  return (
    <axesHelper args={[10]} />
  );
};

// Debug points at each board position
const GridPoints: React.FC = () => {
  // Define the grid positions to show points
  const gridPositions: Position[] = [
    [0, 0], [0, 1], [0, 2], [0, 3], [0, 6], [0, 7],  // Top row
    [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7],  // Middle row
    [2, 0], [2, 1], [2, 2], [2, 3], [2, 6], [2, 7]   // Bottom row
  ];
  
  return (
    <group>
      {gridPositions.map(([row, col], index) => {
        const x = START_X + col * (SQUARE_SIZE + SPACING);
        const z = START_Z + row * (SQUARE_SIZE + SPACING);
        
        return (
          <mesh key={`point-${row}-${col}`} position={[x, 0.5, z]}>
            <sphereGeometry args={[0.1, 16, 16]} />
            <meshBasicMaterial color="yellow" />
          </mesh>
        );
      })}
    </group>
  );
};

// Single debug piece component
const DebugPiece: React.FC<{ position: Position; color: string }> = ({ position, color }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Calculate the 3D position from the 2D board position
  const [row, col] = position;
  const x = START_X + col * (SQUARE_SIZE + SPACING);
  const z = START_Z + row * (SQUARE_SIZE + SPACING);
  const y = 0.6; // Raised slightly above the board
  
  return (
    <mesh ref={meshRef} position={[x, y, z]} castShadow>
      <cylinderGeometry args={[0.4, 0.4, PIECE_HEIGHT, 32]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      
      {/* Add a floating text label to debug the position */}
      <Text
        position={[0, 0.5, 0]}
        color="white"
        fontSize={0.2}
        anchorX="center"
        anchorY="middle"
      >
        {`${row},${col}`}
      </Text>
    </mesh>
  );
};

// Main debug component
export const DebugPieces: React.FC = () => {
  return (
    <group>
      <AxisHelper />
      <GridPoints />
      
      {/* Test pieces at the specifically requested locations */}
      <DebugPiece position={[0, 0]} color="#ffffff" /> {/* White piece at 0,0 */}
      <DebugPiece position={[0, 2]} color="#101010" /> {/* Black piece at 0,2 */}
      <DebugPiece position={[2, 1]} color="#101010" /> {/* Black piece at 2,1 */}
      <DebugPiece position={[2, 6]} color="#ffffff" /> {/* White piece at 2,6 */}
    </group>
  );
}; 