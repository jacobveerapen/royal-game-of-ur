export type Position = [number, number]

export type Player = 1 | 2

export interface GameState {
  currentPlayer: Player
  board: {
    [key: string]: Player | null
  }
  dice: number[]
  winner: Player | null
}

export interface Square {
  position: Position
  isRosette: boolean
  piece: Player | null
}

export interface GamePieceProps {
  player: Player
  position: Position
  selected: boolean
  onSelect: () => void
}

export interface SquareProps {
  position: [number, number, number]
  isRosette: boolean
  isHighlighted: boolean
  onClick: () => void
} 