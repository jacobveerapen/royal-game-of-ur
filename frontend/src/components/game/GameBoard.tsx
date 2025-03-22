import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Board } from './Board'

export const GameBoard = () => {
  return (
    <div style={{ 
      width: '100%', 
      height: '100%',
      position: 'absolute',
      top: 0,
      left: 0
    }}>
      <Canvas
        camera={{ position: [0, 8, 12], fov: 50 }}
        style={{ background: '#2c3e50' }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 10, 5]} intensity={0.6} />
        <directionalLight position={[-5, 10, -5]} intensity={0.4} />
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          maxPolarAngle={Math.PI / 2}
          minDistance={5}
          maxDistance={20}
        />
        <Board />
      </Canvas>
    </div>
  )
} 