import { useRef } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'

// Interface for counter props
interface CounterProps {
  position: [number, number, number]
  color: 'black' | 'white'
  index: number
  onClick?: () => void
}

// Interface for counter stack props
interface CounterStackProps {
  position: [number, number, number]
  color: 'black' | 'white'
  count: number
  player: string
  inPlay?: number
  onCounterClick?: () => void
}

// Constants
const COUNTER_RADIUS = 0.35
const COUNTER_HEIGHT = 0.08  // Slightly thinner counters
const COUNTER_SPACING = 0.01  // Tighter spacing for a more cohesive stack
const COUNTER_SEGMENTS = 32   // Higher segment count for smoother cylinders

// Single counter component
const Counter = ({ position, color, index, onClick }: CounterProps) => {
  const counterRef = useRef<THREE.Mesh>(null)
  
  // Calculate height offset based on stack position
  const height = position[1] + (index * (COUNTER_HEIGHT + COUNTER_SPACING))
  
  // Add small random rotation for a more natural look
  const rotationY = color === 'black' ? 0 : Math.PI  // Flip white counters for visual difference
  
  return (
    <mesh
      ref={counterRef}
      position={[position[0], height, position[2]]}
      rotation={[0, rotationY, 0]}
      castShadow
      receiveShadow
      onClick={(e) => {
        e.stopPropagation()
        if (onClick) onClick()
      }}
    >
      <cylinderGeometry args={[COUNTER_RADIUS, COUNTER_RADIUS, COUNTER_HEIGHT, COUNTER_SEGMENTS]} />
      <meshStandardMaterial
        color={color === 'white' ? '#ffffff' : '#101010'}
        roughness={0.3}
        metalness={0.4}
        emissive={color === 'white' ? '#222222' : '#000000'}
        emissiveIntensity={0.1}
      />
      
      {/* Add subtle edge highlight/bevel */}
      <mesh position={[0, COUNTER_HEIGHT/2 - 0.01, 0]} scale={0.98}>
        <cylinderGeometry args={[COUNTER_RADIUS, COUNTER_RADIUS * 0.97, 0.02, COUNTER_SEGMENTS]} />
        <meshStandardMaterial
          color={color === 'white' ? '#eeeeee' : '#2a2a2a'}
          roughness={0.2}
          metalness={0.5}
        />
      </mesh>
    </mesh>
  )
}

// Stack of counters component
export const CounterStack = ({ position, color, count, player, inPlay = 0, onCounterClick }: CounterStackProps) => {
  // Create array of indices for the counters
  const indices = Array.from({ length: count }, (_, i) => i)
  
  // Handle counter click
  const handleCounterClick = () => {
    console.log(`${player} counter clicked`)
    if (onCounterClick) onCounterClick()
  }
  
  return (
    <group position={position}>
      {indices.map((index) => (
        <Counter
          key={index}
          position={[0, 0, 0]}
          color={color}
          index={index}
          onClick={handleCounterClick}
        />
      ))}
      
      {/* Player label */}
      <Html 
        position={[0, -0.3, 0]} 
        transform
        sprite
        occlude
        distanceFactor={15}
      >
        <div style={{
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: color === 'white' ? 'white' : '#ccc',
          padding: '5px 10px',
          borderRadius: '4px',
          fontFamily: 'Arial, sans-serif',
          fontWeight: 'bold',
          fontSize: '14px',
          textAlign: 'center',
          width: '100px',
          userSelect: 'none',
          pointerEvents: 'none',
        }}>
          {player}
          <div style={{ fontSize: '12px', marginTop: '3px' }}>
            Reserve: {count} | In play: {inPlay}
          </div>
        </div>
      </Html>
    </group>
  )
}

// Main component that renders both stacks
export const GameCounters = () => {
  // These values would normally come from game state
  // For now we're using static values for display
  const blackInPlay = 0
  const whiteInPlay = 0
  
  // Handler for when a player clicks on their counter stack
  const handlePlayerCounterClick = (player: string) => {
    console.log(`${player} wants to move a piece`)
    // In a full implementation, this would trigger game logic
  }
  
  return (
    <group>
      {/* Black counters on near side (player's side) */}
      <CounterStack
        position={[-4, 0.25, 4.5]}  // Adjusted to be more visible
        color="black"
        count={7}
        player="Player 1"
        inPlay={blackInPlay}
        onCounterClick={() => handlePlayerCounterClick("Player 1")}
      />
      
      {/* White counters on far side (opponent's side) */}
      <CounterStack
        position={[-4, 0.25, -4.5]}  // Adjusted to be more visible
        color="white"
        count={7}
        player="Player 2"
        inPlay={whiteInPlay}
        onCounterClick={() => handlePlayerCounterClick("Player 2")}
      />
    </group>
  )
} 