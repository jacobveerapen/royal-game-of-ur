import { useRef } from 'react'
import * as THREE from 'three'
import { GamePieceProps } from '../../types/game'

const SQUARE_SIZE = 1.2
const SPACING = 0.2
const START_X = -7
const START_Z = -3.5

export const GamePiece = ({ player, position, selected, onSelect }: GamePieceProps) => {
  const pieceRef = useRef<THREE.Mesh>(null)

  const [x, z] = [
    START_X + position[1] * (SQUARE_SIZE + SPACING),
    START_Z + position[0] * (SQUARE_SIZE + SPACING)
  ]

  return (
    <mesh
      ref={pieceRef}
      position={[x, 0.5, z]}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      <cylinderGeometry args={[0.4, 0.4, 0.2, 32]} />
      <meshStandardMaterial
        color={player === 1 ? '#8b0000' : '#00008b'}
        emissive={selected ? '#555555' : '#000000'}
        roughness={0.5}
        metalness={0.5}
      />
    </mesh>
  )
} 