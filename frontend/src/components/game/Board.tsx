import { useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { Position } from '../../types/game'
import rosetteImage from '../../assets/images/rosette.png'

const SQUARE_SIZE = 1.2
const SPACING = 0.2
const START_X = -7
const START_Z = -3.5
const BASE_THICKNESS = 1.0
const BORDER_WIDTH = 0.3

const ROSETTES: Position[] = [
  [0, 0], // P2 start rosette
  [0, 6], // P2 end rosette
  [1, 3], // Middle rosette
  [2, 0], // P1 start rosette
  [2, 6]  // P1 end rosette
]

const VALID_SQUARES: Position[] = [
  // Player 2 path (top row)
  [0,0], [0,1], [0,2], [0,3], [0,6], [0,7],
  // Shared path (middle row)
  [1,0], [1,1], [1,2], [1,3], [1,4], [1,5], [1,6], [1,7],
  // Player 1 path (bottom row)
  [2,0], [2,1], [2,2], [2,3], [2,6], [2,7]
]

// Create the textures outside of the component to avoid recreation
const textureLoader = new THREE.TextureLoader();

// Create dotPattern texture
const createDotPatternTexture = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  
  ctx.fillStyle = '#f5f5dc'
  ctx.fillRect(0, 0, 256, 256)
  
  ctx.fillStyle = '#1e3a8a'
  const dotSize = 15
  const spacing = 50
  
  for (let y = spacing; y < 256; y += spacing) {
    for (let x = spacing; x < 256; x += spacing) {
      ctx.beginPath()
      ctx.arc(x, y, dotSize, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  return texture
}

const dotTexture = createDotPatternTexture();

// Create side texture
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

  // Materials
  const dotMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      map: dotTexture,
      color: '#ffffff',
      metalness: 0.2,
      roughness: 0.8
    })
  }, []);

  // Load rosette texture once but create unique instances for each tile
  const rosetteTexture = useMemo(() => {
    const texture = textureLoader.load(rosetteImage);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }, []);

  const sideMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      map: sideTexture,
      side: THREE.DoubleSide
    })
  }, []);

  // Create a new rosette material for each tile to avoid sharing issues
  const createRosetteMaterial = () => {
    return new THREE.MeshStandardMaterial({
      map: rosetteTexture.clone(), // Clone the texture for each instance
      color: '#ffffff',
      emissive: '#333333',
      metalness: 0,
      roughness: 0.2,
      side: THREE.DoubleSide
    });
  };

  // Check if a position is a rosette
  const isRosette = (pos: Position) => {
    for (const [row, col] of ROSETTES) {
      if (row === pos[0] && col === pos[1]) {
        console.log(`Rosette found at position: [${pos[0]}, ${pos[1]}]`);
        return true;
      }
    }
    return false;
  }

  // Create a base section of the board
  const createBaseSection = (startCol: number, endCol: number, row: number) => {
    const width = (endCol - startCol + 1) * (SQUARE_SIZE + SPACING) - SPACING + BORDER_WIDTH * 2
    const depth = SQUARE_SIZE + BORDER_WIDTH * 2
    const x = START_X + (startCol + (endCol - startCol) / 2) * (SQUARE_SIZE + SPACING)
    const z = START_Z + row * (SQUARE_SIZE + SPACING)

    const clonedMaterial = sideMaterial.clone();
    if (clonedMaterial.map) {
      clonedMaterial.map = sideTexture.clone();
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

  // Log all rosette positions on component mount
  useEffect(() => {
    console.log("Rosette positions:", ROSETTES);
    
    // Check all board positions
    VALID_SQUARES.forEach(pos => {
      if (isRosette(pos)) {
        console.log(`Valid rosette at [${pos[0]}, ${pos[1]}]`);
      }
    });
  }, []);

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
        
        return (
          <group key={`tile-${row}-${col}`} position={[x, y, z]}>
            {isRosetteTile ? (
              // Complete rosette tile implementation with all sides properly handled
              <>
                {/* Main tile as a complete box with solid color */}
                <mesh position={[0, 0.05, 0]}>
                  <boxGeometry args={[SQUARE_SIZE, 0.15, SQUARE_SIZE]} />
                  <meshStandardMaterial color="#f8f6db" />
                </mesh>
                
                {/* Top face with rosette texture (slightly above the base to avoid z-fighting) */}
                <mesh position={[0, 0.125 + 0.001, 0]} rotation={[-Math.PI/2, 0, 0]}>
                  <planeGeometry args={[SQUARE_SIZE, SQUARE_SIZE]} />
                  <meshStandardMaterial 
                    map={rosetteTexture}
                    transparent={true}
                    color="#ffffff"
                    emissive="#333333"
                    metalness={0}
                    roughness={0.2}
                    side={THREE.FrontSide}
                  />
                </mesh>
              </>
            ) : (
              // Regular tile
              <mesh>
                <boxGeometry args={[SQUARE_SIZE, 0.1, SQUARE_SIZE]} />
                <primitive object={dotMaterial} />
              </mesh>
            )}
          </group>
        )
      })}
    </group>
  )
}