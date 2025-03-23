import { GameBoard } from './components/game/GameBoard'
import { Terminal } from './components/terminal/Terminal'
import './App.css'

function App() {
  return (
    <div className="App" style={{ width: '100vw', height: '100vh', display: 'flex' }}>
      <div className="game-container" style={{ flex: 1, position: 'relative' }}>
        <GameBoard />
      </div>
      <div className="terminal-container" style={{ width: '40%', height: '100%', borderLeft: '1px solid #444' }}>
        <Terminal />
      </div>
    </div>
  )
}

export default App
