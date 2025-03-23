import { useRef } from 'react'
import * as THREE from 'three'
import { SquareProps } from '../../types/game'

const SQUARE_SIZE = 1.2

export const Square = ({ position, isRosette, isHighlighted, onClick }: SquareProps) => {
  const groupRef = useRef<THREE.Group>(null)

  return (
    <group ref={groupRef} position={position}>
      {/* Border */}
      <mesh position={[0, -0.01, 0]}>
        <boxGeometry args={[SQUARE_SIZE + 0.1, 0.12, SQUARE_SIZE + 0.1]} />
        <meshStandardMaterial color="#2c1810" roughness={0.7} />
      </mesh>

      {/* Main square */}
      <mesh onClick={onClick}>
        <boxGeometry args={[SQUARE_SIZE, 0.1, SQUARE_SIZE]} />
        <meshStandardMaterial 
          color={isHighlighted ? '#00ff00' : (isRosette ? '#d4af37' : '#f5deb3')} 
          roughness={0.5}
        />
      </mesh>

      {/* Rosette decoration */}
      {isRosette && (
        <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.06, 0]}>
          <circleGeometry args={[SQUARE_SIZE/3, 8]} />
          <meshStandardMaterial color="#8b4513" side={2} />
        </mesh>
      )}
    </group>
  )
} 