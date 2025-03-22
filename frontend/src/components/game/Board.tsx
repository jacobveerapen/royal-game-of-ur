import { useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { Position } from '../../types/game'
import rosetteImage from '../../assets/images/rosette.png'
import tileVariant1 from '../../assets/images/tile_variant_1.png'
import tileVariant2 from '../../assets/images/tile_variant_2.png'
import tileVariant3 from '../../assets/images/tile_variant_3.png'
import tileVariant4 from '../../assets/images/tile_variant_4.png'

const SQUARE_SIZE = 1.2
const SPACING = 0.2
const START_X = -7
const START_Z = -3.5
const BASE_THICKNESS = 1.0
const BORDER_WIDTH = 0.3
const TILE_SIDE_COLOR = '#f8f6db'

// Define rosette positions
const ROSETTES: Position[] = [
  [0, 0], // P2 start rosette
  [0, 6], // P2 end rosette
  [1, 3], // Middle rosette
  [2, 0], // P1 start rosette
  [2, 6]  // P1 end rosette
]

// Define valid square positions
const VALID_SQUARES: Position[] = [
  // Player 2 path (top row)
  [0,0], [0,1], [0,2], [0,3], [0,6], [0,7],
  // Shared path (middle row)
  [1,0], [1,1], [1,2], [1,3], [1,4], [1,5], [1,6], [1,7],
  // Player 1 path (bottom row)
  [2,0], [2,1], [2,2], [2,3], [2,6], [2,7]
]

// Create side texture for the board base
const createSideTexture = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  
  ctx.fillStyle = '#f5f5dc'
  ctx.fillRect(0, 0, 256, 64)
  
  ctx.strokeStyle = '#8b4513'
  ctx.fillStyle = '#8b4513'
  const triangleHeight = 20
  const triangleWidth = 20
  const spacing = 40
  
  for (let x = spacing/2; x < 256; x += spacing) {
    ctx.beginPath()
    ctx.moveTo(x, 10)
    ctx.lineTo(x - triangleWidth/2, 10 + triangleHeight)
    ctx.lineTo(x + triangleWidth/2, 10 + triangleHeight)
    ctx.closePath()
    ctx.fill()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  return texture
}

const sideTexture = createSideTexture();

export const Board = () => {
  const boardRef = useRef<THREE.Group>(null)

  // Check if a position is a rosette
  const isRosette = (pos: Position): boolean => {
    return ROSETTES.some(([row, col]) => row === pos[0] && col === pos[1]);
  }

  // Get variant type for regular tiles (1-4)
  const getTileVariant = (pos: Position): number => {
    const [row, col] = pos;
    
    // Ensure symmetry between player 1 and player 2 sides
    if (row === 0 || row === 2) {  // Player rows
      if (col === 1) return 1;
      if (col === 2) return 2;
      if (col === 3) return 3;
      if (col === 7) return 4;
    }
    
    // Middle shared row
    if (row === 1) {
      if (col === 0 || col === 7) return 1;
      if (col === 1 || col === 6) return 2;
      if (col === 2 || col === 5) return 3;
      if (col === 4) return 4;
    }
    
    // Default to variant 1
    return 1;
  }
  
  // Create a base section of the board
  const createBaseSection = (startCol: number, endCol: number, row: number) => {
    const width = (endCol - startCol + 1) * (SQUARE_SIZE + SPACING) - SPACING + BORDER_WIDTH * 2
    const depth = SQUARE_SIZE + BORDER_WIDTH * 2
    const x = START_X + (startCol + (endCol - startCol) / 2) * (SQUARE_SIZE + SPACING)
    const z = START_Z + row * (SQUARE_SIZE + SPACING)

    const sideMaterial = new THREE.MeshStandardMaterial({
      map: sideTexture,
      side: THREE.DoubleSide
    });
    
    const clonedMaterial = sideMaterial.clone();
    if (clonedMaterial.map) {
      clonedMaterial.map.repeat.set(width/2, 1);
      clonedMaterial.map.needsUpdate = true;
    }

    return (
      <group key={`base-${row}-${startCol}-${endCol}`} position={[x, 0, z]}>
        {/* Main base */}
        <mesh>
          <boxGeometry args={[width, BASE_THICKNESS, depth]} />
          <meshStandardMaterial color="#8b4513" />
        </mesh>
        
        {/* Sides */}
        <mesh position={[0, -BASE_THICKNESS/2, depth/2]}>
          <planeGeometry args={[width, BASE_THICKNESS]} />
          <primitive object={clonedMaterial} />
        </mesh>
        <mesh position={[0, -BASE_THICKNESS/2, -depth/2]}>
          <planeGeometry args={[width, BASE_THICKNESS]} />
          <primitive object={clonedMaterial} />
        </mesh>
        <mesh position={[-width/2, -BASE_THICKNESS/2, 0]} rotation={[0, Math.PI/2, 0]}>
          <planeGeometry args={[depth, BASE_THICKNESS]} />
          <primitive object={clonedMaterial} />
        </mesh>
        <mesh position={[width/2, -BASE_THICKNESS/2, 0]} rotation={[0, -Math.PI/2, 0]}>
          <planeGeometry args={[depth, BASE_THICKNESS]} />
          <primitive object={clonedMaterial} />
        </mesh>
      </group>
    )
  }

  return (
    <group ref={boardRef}>
      {/* Base sections */}
      {createBaseSection(0, 3, 0)}    {/* Top row (0-3) */}
      {createBaseSection(0, 7, 1)}    {/* Middle row (full width) */}
      {createBaseSection(0, 3, 2)}    {/* Bottom row (0-3) */}
      {createBaseSection(6, 7, 0)}    {/* Top right (6-7) */}
      {createBaseSection(6, 7, 2)}    {/* Bottom right (6-7) */}

      {/* Game squares */}
      {VALID_SQUARES.map(([row, col]) => {
        const [x, y, z] = [
          START_X + col * (SQUARE_SIZE + SPACING),
          BASE_THICKNESS/2,
          START_Z + row * (SQUARE_SIZE + SPACING)
        ]
        
        const isRosetteTile = isRosette([row, col]);
        const tileHeight = isRosetteTile ? 0.15 : 0.1;
        
        // Determine which image to use
        let textureUrl;
        if (isRosetteTile) {
          textureUrl = rosetteImage;
        } else {
          const variant = getTileVariant([row, col]);
          switch (variant) {
            case 1: textureUrl = tileVariant1; break;
            case 2: textureUrl = tileVariant2; break;
            case 3: textureUrl = tileVariant3; break;
            case 4: textureUrl = tileVariant4; break;
            default: textureUrl = tileVariant1;
          }
        }

        return (
          <group key={`tile-${row}-${col}`} position={[x, y, z]}>
            {/* Base tile with solid color sides */}
            <mesh position={[0, tileHeight/2, 0]}>
              <boxGeometry args={[SQUARE_SIZE, tileHeight, SQUARE_SIZE]} />
              <meshStandardMaterial color={TILE_SIDE_COLOR} />
            </mesh>
            
            {/* Top face with texture */}
            <mesh position={[0, tileHeight, 0]} rotation={[-Math.PI/2, 0, 0]}>
              <planeGeometry args={[SQUARE_SIZE, SQUARE_SIZE]} />
              <meshStandardMaterial 
                map={new THREE.TextureLoader().load(textureUrl)}
                transparent={true}
                side={THREE.FrontSide}
                color="#ffffff"
              />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}