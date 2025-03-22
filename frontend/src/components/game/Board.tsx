import { useRef, useState, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Position } from '../../types/game'

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

// Create static textures outside the component
const textureFactory = (() => {
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
    texture.needsUpdate = false
    return texture
  }

  const createRosetteTexture = () => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')!
    
    ctx.fillStyle = '#f5f5dc'
    ctx.fillRect(0, 0, 256, 256)
    
    ctx.strokeStyle = '#1e3a8a'
    ctx.lineWidth = 4
    ctx.beginPath()
    
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4
      const x = 128 + Math.cos(angle) * 60
      const y = 128 + Math.sin(angle) * 60
      ctx.moveTo(128, 128)
      ctx.lineTo(x, y)
    }
    
    ctx.arc(128, 128, 40, 0, Math.PI * 2)
    ctx.stroke()
    
    ctx.fillStyle = '#1e3a8a'
    ctx.beginPath()
    ctx.arc(128, 128, 10, 0, Math.PI * 2)
    ctx.fill()

    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = false
    return texture
  }

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
    texture.needsUpdate = false
    return texture
  }

  // Create static instances
  const sideTexture = createSideTexture()
  const rosetteTexture = createRosetteTexture()
  const dotTexture = createDotPatternTexture()

  return {
    sideTexture,
    rosetteTexture,
    dotTexture
  }
})()

export const Board = () => {
  const [selectedPiece, setSelectedPiece] = useState<string | null>(null)
  const [validMoves, setValidMoves] = useState<Position[]>([])
  const boardRef = useRef<THREE.Group>(null)

  // Create static materials
  const materials = useMemo(() => {
    const sideMaterial = new THREE.MeshStandardMaterial({
      map: textureFactory.sideTexture,
      side: THREE.DoubleSide
    })

    const rosetteMaterial = new THREE.MeshStandardMaterial({
      map: textureFactory.rosetteTexture,
      color: '#ffffff',
      metalness: 0.2,
      roughness: 0.8
    })

    const dotMaterial = new THREE.MeshStandardMaterial({
      map: textureFactory.dotTexture,
      color: '#ffffff',
      metalness: 0.2,
      roughness: 0.8
    })

    return { sideMaterial, rosetteMaterial, dotMaterial }
  }, [])

  const isRosette = (pos: Position) => 
    ROSETTES.some(([row, col]) => row === pos[0] && col === pos[1])

  const isValidSquare = (pos: Position) =>
    VALID_SQUARES.some(([row, col]) => row === pos[0] && col === pos[1])

  const getSquarePosition = (row: number, col: number): [number, number, number] => [
    START_X + col * (SQUARE_SIZE + SPACING),
    0.3,
    START_Z + row * (SQUARE_SIZE + SPACING)
  ]

  const createTileGeometry = () => {
    const geometry = new THREE.BoxGeometry(SQUARE_SIZE, BASE_THICKNESS, SQUARE_SIZE)
    return geometry
  }

  const createBaseSection = (startCol: number, endCol: number, row: number) => {
    const width = (endCol - startCol + 1) * (SQUARE_SIZE + SPACING) - SPACING + BORDER_WIDTH * 2
    const depth = SQUARE_SIZE + BORDER_WIDTH * 2
    const x = START_X + (startCol + (endCol - startCol) / 2) * (SQUARE_SIZE + SPACING)
    const z = START_Z + row * (SQUARE_SIZE + SPACING)

    const material = materials.sideMaterial.clone()
    material.map = textureFactory.sideTexture.clone()
    material.map.repeat.set(width/2, 1)
    material.map.needsUpdate = true

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
          <primitive object={material} />
        </mesh>
        <mesh position={[0, -BASE_THICKNESS/2, -depth/2]}>
          <planeGeometry args={[width, BASE_THICKNESS]} />
          <primitive object={material} />
        </mesh>
        <mesh position={[-width/2, -BASE_THICKNESS/2, 0]} rotation={[0, Math.PI/2, 0]}>
          <planeGeometry args={[depth, BASE_THICKNESS]} />
          <primitive object={material} />
        </mesh>
        <mesh position={[width/2, -BASE_THICKNESS/2, 0]} rotation={[0, -Math.PI/2, 0]}>
          <planeGeometry args={[depth, BASE_THICKNESS]} />
          <primitive object={material} />
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
        
        return (
          <mesh key={`${row}-${col}`} position={[x, y, z]}>
            <boxGeometry args={[SQUARE_SIZE, 0.1, SQUARE_SIZE]} />
            <primitive object={isRosette([row, col]) ? materials.rosetteMaterial : materials.dotMaterial} />
          </mesh>
        )
      })}
    </group>
  )
} 