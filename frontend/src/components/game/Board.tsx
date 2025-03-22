import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { Position } from '../../types/game'
import rosetteImage from '../../assets/images/rosette.png'
import tileVariant1 from '../../assets/images/tile_variant_1.png'
import tileVariant2 from '../../assets/images/tile_variant_2.png'
import tileVariant3 from '../../assets/images/tile_variant_3.png'
import tileVariant4 from '../../assets/images/tile_variant_4.png'
import blueBackground from '../../assets/images/blue_background.png'

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

// Create a single texture loader that will be reused
const textureLoader = new THREE.TextureLoader();

// Pre-load textures to avoid flickering
const preloadedTextures = {
  rosette: textureLoader.load(rosetteImage),
  variant1: textureLoader.load(tileVariant1),
  variant2: textureLoader.load(tileVariant2),
  variant3: textureLoader.load(tileVariant3),
  variant4: textureLoader.load(tileVariant4),
  background: textureLoader.load(blueBackground)
};

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
  
  // Get the appropriate texture for a tile
  const getTileTexture = useMemo(() => (pos: Position) => {
    if (isRosette(pos)) {
      return preloadedTextures.rosette;
    } else {
      const variant = getTileVariant(pos);
      switch (variant) {
        case 1: return preloadedTextures.variant1;
        case 2: return preloadedTextures.variant2;
        case 3: return preloadedTextures.variant3;
        case 4: return preloadedTextures.variant4;
        default: return preloadedTextures.variant1;
      }
    }
  }, []);
  
  // Create a base section of the board
  const createBaseSection = (startCol: number, endCol: number, row: number) => {
    const width = (endCol - startCol + 1) * (SQUARE_SIZE + SPACING) - SPACING + BORDER_WIDTH * 2
    const depth = SQUARE_SIZE + BORDER_WIDTH * 2
    const x = START_X + (startCol + (endCol - startCol) / 2) * (SQUARE_SIZE + SPACING)
    const z = START_Z + row * (SQUARE_SIZE + SPACING)

    // The thickness of the blue border layer (1.5mm = 0.0015 meters = 0.15 in THREE.js units)
    const BLUE_BORDER_THICKNESS = 0.15
    
    const sideMaterial = new THREE.MeshStandardMaterial({
      map: sideTexture,
      side: THREE.DoubleSide
    });
    
    const clonedMaterial = sideMaterial.clone();
    if (clonedMaterial.map) {
      clonedMaterial.map.repeat.set(width/2, 1);
      clonedMaterial.map.needsUpdate = true;
    }

    // Create a blue background texture for the top of the base
    const backgroundTexture = preloadedTextures.background.clone();
    backgroundTexture.repeat.set(width/2, depth/2);
    backgroundTexture.wrapS = THREE.RepeatWrapping;
    backgroundTexture.wrapT = THREE.RepeatWrapping;
    backgroundTexture.needsUpdate = true;

    // Create material for blue side border
    const blueBorderMaterial = new THREE.MeshStandardMaterial({
      map: backgroundTexture,
      side: THREE.DoubleSide
    });

    return (
      <group key={`base-${row}-${startCol}-${endCol}`} position={[x, 0, z]}>
        {/* Main base with brown sides */}
        <mesh>
          <boxGeometry args={[width, BASE_THICKNESS, depth]} />
          <meshStandardMaterial color="#8b4513" />
        </mesh>
        
        {/* Top blue background layer */}
        <mesh position={[0, BASE_THICKNESS/2 + 0.001, 0]} rotation={[-Math.PI/2, 0, 0]}>
          <planeGeometry args={[width, depth]} />
          <meshStandardMaterial 
            map={backgroundTexture}
            side={THREE.DoubleSide}
          />
        </mesh>
        
        {/* Blue border layer on front side */}
        <mesh position={[0, BASE_THICKNESS/2 - BLUE_BORDER_THICKNESS/2, depth/2 + 0.001]}>
          <planeGeometry args={[width, BLUE_BORDER_THICKNESS]} />
          <meshStandardMaterial 
            map={backgroundTexture}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Blue border layer on back side */}
        <mesh position={[0, BASE_THICKNESS/2 - BLUE_BORDER_THICKNESS/2, -depth/2 - 0.001]}>
          <planeGeometry args={[width, BLUE_BORDER_THICKNESS]} />
          <meshStandardMaterial 
            map={backgroundTexture}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Blue border layer on left side */}
        <mesh position={[-width/2 - 0.001, BASE_THICKNESS/2 - BLUE_BORDER_THICKNESS/2, 0]} rotation={[0, Math.PI/2, 0]}>
          <planeGeometry args={[depth, BLUE_BORDER_THICKNESS]} />
          <meshStandardMaterial 
            map={backgroundTexture}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Blue border layer on right side */}
        <mesh position={[width/2 + 0.001, BASE_THICKNESS/2 - BLUE_BORDER_THICKNESS/2, 0]} rotation={[0, -Math.PI/2, 0]}>
          <planeGeometry args={[depth, BLUE_BORDER_THICKNESS]} />
          <meshStandardMaterial 
            map={backgroundTexture}
            side={THREE.DoubleSide}
          />
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
        const texture = getTileTexture([row, col]);

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
                map={texture}
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