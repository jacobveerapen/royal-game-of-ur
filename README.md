# Royal Game of Ur

A 3D web implementation of the ancient Royal Game of Ur, featuring a Python backend for game logic and a Three.js frontend for visualization.

## Game Rules

The Royal Game of Ur is one of the oldest known board games, dating back to around 2600 BCE. This implementation follows these rules:

- The game board has 20 squares arranged in a specific pattern
- Each player has 7 pieces that must complete the journey across the board
- Movement is determined by rolling 4 binary dice (values: 0 or 1)
- Players can capture opponent's pieces by landing on them
- Special "rosette" squares grant an extra turn
- First player to get all 7 pieces to the end wins

## Project Structure

- `backend/` - Python backend implementing game logic and API
  - `ur_game/` - Core game logic module
  - `tests/` - Unit tests
- `frontend/` - React + Three.js frontend
  - `src/` - Source code for the web interface

## Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Run tests:
```bash
pytest backend/tests/
```

## Development

More details will be added as the project progresses. 