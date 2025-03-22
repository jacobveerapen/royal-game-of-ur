import { useState, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'

// Interface for tile props
interface TileProps {
  position: [number, number, number]
  value: number
  isFlipping: boolean
  onAnimationComplete?: () => void
}

// Interface for dice controller props
interface DiceControllerProps {
  onRollComplete?: (results: number[]) => void
}

// Constants
const TILE_SIZE = 0.8
const ANIMATION_DURATION = 250 // ms
const TILE_COUNT = 4

// Simple binary tile component
export const Tile = ({ position, value, isFlipping, onAnimationComplete }: TileProps) => {
  const groupRef = useRef<THREE.Group>(null)
  const [animationProgress, setAnimationProgress] = useState(0)
  const [animationComplete, setAnimationComplete] = useState(false)
  
  // Reset animation state when flipping starts
  useEffect(() => {
    if (isFlipping) {
      setAnimationProgress(0)
      setAnimationComplete(false)
    }
  }, [isFlipping])
  
  // Handle animation frames
  useFrame((_, delta) => {
    if (isFlipping && !animationComplete && groupRef.current) {
      // Update animation progress
      setAnimationProgress(prev => {
        const newProgress = prev + (delta * 1000 / ANIMATION_DURATION)
        
        // If animation completed in this frame
        if (newProgress >= 1 && !animationComplete) {
          setAnimationComplete(true)
          if (onAnimationComplete) {
            onAnimationComplete()
          }
          return 1 // Cap at 1
        }
        
        return Math.min(newProgress, 1)
      })
      
      // Apply scale animation
      if (animationProgress < 0.5) {
        groupRef.current.scale.x = 1 - (animationProgress * 2)
      } else {
        groupRef.current.scale.x = (animationProgress - 0.5) * 2
      }
    }
  })
  
  // Determine current visual color based on animation state
  const getColor = () => {
    if (!isFlipping || animationComplete) {
      return value === 1 ? "white" : "black"
    }
    
    // During animation, flip color at halfway point
    if (animationProgress < 0.5) {
      return value === 1 ? "white" : "black"
    } else {
      return value === 1 ? "black" : "white" 
    }
  }
  
  return (
    <group position={position}>
      <group ref={groupRef}>
        <mesh 
          rotation={[-Math.PI/2, 0, 0]} 
          position={[0, 0.01, 0]}
        >
          <planeGeometry args={[TILE_SIZE, TILE_SIZE]} />
          <meshStandardMaterial 
            color={getColor()}
            roughness={0.3} 
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </group>
  )
}

// Controller for all tiles with roll button
export const DiceController: React.FC<DiceControllerProps> = ({ onRollComplete }) => {
  const [isRolling, setIsRolling] = useState(false)
  const [tileValues, setTileValues] = useState([0, 0, 0, 0])
  const [newTileValues, setNewTileValues] = useState([0, 0, 0, 0])
  const [animationsComplete, setAnimationsComplete] = useState(0)
  
  // Foreground tile positions - moved forward on the table
  const tilePositions: [number, number, number][] = [
    [2.0, 0, 4.0],  // top left 
    [3.0, 0, 4.0],  // top right
    [2.0, 0, 3.0],  // bottom left
    [3.0, 0, 3.0],  // bottom right
  ]
  
  // Handle roll button click
  const handleRoll = () => {
    if (isRolling) return
    
    // Generate new random values for all tiles
    const newValues = Array(TILE_COUNT).fill(0).map(() => Math.random() > 0.5 ? 1 : 0)
    
    // Store new values but don't apply them yet (they'll be applied after animation)
    setNewTileValues(newValues)
    setIsRolling(true)
    setAnimationsComplete(0)
    
    console.log("New random values:", newValues)
  }
  
  // Handle when a tile animation completes
  const handleTileAnimationComplete = (index: number) => {
    // After animation completes, update the tile to its new value
    setTileValues(prev => {
      const updated = [...prev]
      updated[index] = newTileValues[index]
      return updated
    })
    
    // Increment completed animations counter
    setAnimationsComplete(prev => {
      const newCount = prev + 1
      
      // If all animations are complete, notify parent
      if (newCount >= TILE_COUNT) {
        if (onRollComplete) {
          onRollComplete([...newTileValues])
        }
        
        // End rolling state
        setTimeout(() => {
          setIsRolling(false)
        }, 50)
      }
      
      return newCount
    })
  }
  
  return (
    <group>
      {/* Render tiles */}
      {tilePositions.map((position, index) => (
        <Tile 
          key={index}
          position={position}
          value={tileValues[index]} 
          isFlipping={isRolling}
          onAnimationComplete={() => handleTileAnimationComplete(index)}
        />
      ))}
      
      {/* Large 3D Roll button - moved to foreground */}
      <group position={[2.5, 0.15, 1.8]}>
        {/* Base of button - main clickable area */}
        <mesh position={[0, 0, 0]} castShadow receiveShadow onClick={handleRoll}>
          <boxGeometry args={[1.8, 0.3, 0.8]} />
          <meshStandardMaterial 
            color={isRolling ? "#555555" : "#884400"} 
            roughness={0.7}
            metalness={0.2}
          />
        </mesh>
        
        {/* Button top surface with bevel */}
        <mesh position={[0, 0.16, 0]} castShadow onClick={handleRoll}>
          <boxGeometry args={[1.7, 0.05, 0.7]} />
          <meshStandardMaterial 
            color={isRolling ? "#666666" : "#aa5500"} 
            roughness={0.5}
            metalness={0.3}
          />
        </mesh>
        
        {/* Button text - centered and sized to fit on button top */}
        <mesh position={[0, 0.22, 0]} rotation={[-Math.PI/2, 0, 0]} onClick={handleRoll}>
          <planeGeometry args={[1.65, 0.65]} />
          <meshBasicMaterial transparent opacity={0} />
          <Html position={[0, 0, 0.01]} transform>
            <div 
              style={{ 
                color: 'white', 
                fontSize: '20px',
                fontWeight: 'bold',
                textShadow: '1px 1px 2px rgba(0,0,0,0.7)',
                width: '150px',
                textAlign: 'center',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              ROLL DICE
            </div>
          </Html>
        </mesh>
      </group>
    </group>
  )
}

// HTML Overlay for showing tile results
export const DiceResultOverlay: React.FC<{ results: number[] }> = ({ results }) => {
  const sum = results.reduce((acc, val) => acc + val, 0)
  
  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      right: '20px',
      background: 'rgba(0, 0, 0, 0.7)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontFamily: 'Arial, sans-serif',
      zIndex: 100
    }}>
      <h3 style={{ margin: '0 0 10px 0' }}>White Tiles: {sum}</h3>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
        {results.map((result, i) => (
          <div key={i} style={{
            width: '40px',
            height: '40px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            backgroundColor: result === 1 ? 'white' : 'black',
            border: '2px solid #ccc',
            borderRadius: '3px'
          }} />
        ))}
      </div>
      <p style={{ margin: '10px 0 0 0', textAlign: 'center' }}>
        Move: {sum} {sum === 0 ? '(No move)' : 'spaces'}
      </p>
    </div>
  )
} 