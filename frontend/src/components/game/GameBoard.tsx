import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Board } from './Board'
import { DiceController, DiceResultOverlay } from './Dice'
import { GameCounters } from './GameCounters'
import { useGameState } from '../../hooks/useGameState'

// Table dimensions and appearance
const TABLE_WIDTH = 30
const TABLE_DEPTH = 25
const TABLE_HEIGHT = 0.8
const TABLE_COLOR = '#deb887' // Changed to burlywood - a lighter wood color

// Create table texture
const createTableTexture = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')!
  
  // Base wood color - much lighter
  ctx.fillStyle = '#e8c19a' // Light tan base
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  
  // Add wood grain - more visible now
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * canvas.width
    const y = 0
    const width = 2 + Math.random() * 5
    const height = canvas.height
    
    // Darker grain but still visible against light background
    ctx.fillStyle = `rgba(160, 120, 80, ${Math.random() * 0.3})`
    ctx.fillRect(x, y, width, height)
  }
  
  return new THREE.CanvasTexture(canvas)
}

// Table component
const Table = () => {
  const tableTexture = createTableTexture()
  
  // Define leg positions with proper typing
  const legPositions: [number, number, number][] = [
    [-TABLE_WIDTH/2 + 1, -TABLE_HEIGHT - 2, -TABLE_DEPTH/2 + 1],
    [-TABLE_WIDTH/2 + 1, -TABLE_HEIGHT - 2, TABLE_DEPTH/2 - 1],
    [TABLE_WIDTH/2 - 1, -TABLE_HEIGHT - 2, -TABLE_DEPTH/2 + 1],
    [TABLE_WIDTH/2 - 1, -TABLE_HEIGHT - 2, TABLE_DEPTH/2 - 1]
  ];
  
  return (
    <group>
      {/* Table top */}
      <mesh position={[0, -TABLE_HEIGHT/2, 0]} receiveShadow>
        <boxGeometry args={[TABLE_WIDTH, TABLE_HEIGHT, TABLE_DEPTH]} />
        <meshStandardMaterial color={TABLE_COLOR} map={tableTexture} roughness={0.7} />
      </mesh>
      
      {/* Table legs */}
      {legPositions.map((position, index) => (
        <mesh key={index} position={position} castShadow>
          <cylinderGeometry args={[0.5, 0.5, 4, 16]} />
          <meshStandardMaterial color={TABLE_COLOR} roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

export const GameBoard = () => {
  // Use our game state hook
  const { 
    gameState, 
    rollDice, 
    getDiceTotal 
  } = useGameState()
  
  // Handle dice roll completion
  const handleRollComplete = (results: number[]) => {
    // Update game state with dice results
    rollDice(results)
    
    // Here you would also compute valid moves based on dice results
    // This would be part of a more complete game implementation
  }
  
  return (
    <div style={{ 
      width: '100%', 
      height: '100%',
      position: 'absolute',
      top: 0,
      left: 0,
      overflow: 'hidden'
    }}>
      <Canvas
        shadows
        camera={{ position: [0, 12, 18], fov: 50 }}
        style={{ background: '#2c3e50' }}
        gl={{ antialias: true, alpha: false }}
      >
        {/* Enhanced lighting for table scene */}
        <ambientLight intensity={0.7} />
        <directionalLight 
          position={[5, 10, 5]} 
          intensity={0.8}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-5, 8, -5]} intensity={0.5} />
        <directionalLight position={[0, -5, 8]} intensity={0.3} />
        
        {/* Room light from above */}
        <pointLight position={[0, 15, 0]} intensity={0.8} />
        
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          maxPolarAngle={Math.PI / 2 - 0.1} // Prevent camera from going below the table
          minDistance={8}
          maxDistance={25}
        />
        
        {/* Table */}
        <Table />
        
        {/* Game board and dice - placed on the table */}
        <group position={[0, 0, 0]}>
          {/* Position the Board component on the table surface */}
          <group position={[0, 0.1, 0]}>
            <Board />
          </group>
          <DiceController onRollComplete={handleRollComplete} />
          <GameCounters />
        </group>
      </Canvas>
      
      {/* Overlay to show dice results */}
      <DiceResultOverlay results={gameState.dice} />
      
      {/* Player turn indicator */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        background: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '10px',
        borderRadius: '5px',
        fontFamily: 'Arial, sans-serif',
        zIndex: 100
      }}>
        <h3 style={{ margin: '0' }}>
          Player {gameState.currentPlayer}'s Turn
        </h3>
        <p style={{ margin: '5px 0 0 0' }}>
          Dice Total: {getDiceTotal()}
        </p>
      </div>
    </div>
  )
} 