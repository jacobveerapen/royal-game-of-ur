/**
 * Parses the terminal board representation into a 2D array
 * Input format is expected to be similar to:
 * 
 * Board:
 *    P2 Start   Shared    P2 End
 * 🌺 [ ] [22] [ ]         🌺 [ ]   Top
 * [12] [ ] [ ] 🌺 [ ] [ ] [ ] [ ]   Middle
 * 🌺 [ ] [ ] [ ]         🌺 [ ]   Bottom
 *    P1 Start   Shared    P1 End
 * 
 * Output is a 3x8 2D array where:
 * - null represents an empty square or non-existent square
 * - String values like "12" or "22" represent pieces of player 1 or 2
 */
export function parseTerminalBoard(boardOutput: string): Array<Array<string | null>> {
  // Initialize the 3x8 board with null values
  const board: Array<Array<string | null>> = [
    [null, null, null, null, null, null, null, null], // Top row (row 0)
    [null, null, null, null, null, null, null, null], // Middle row (row 1)
    [null, null, null, null, null, null, null, null]  // Bottom row (row 2)
  ];
  
  // Split the terminal output into lines
  const lines = boardOutput.split('\n');
  
  // Find where the board starts (after "Board:")
  let boardStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === 'Board:') {
      boardStart = i;
      break;
    }
  }
  
  if (boardStart === -1) return board; // Board not found
  
  // Parse the 3 rows of the board
  for (let rowIdx = 0; rowIdx < 3; rowIdx++) {
    const lineIndex = boardStart + 2 + rowIdx; // +2 to skip "Board:" and the header line
    if (lineIndex >= lines.length) continue;
    
    const line = lines[lineIndex];
    const matches = [...line.matchAll(/\[([^\]]*)\]/g)];
    
    // Process each match in the row
    for (let colIdx = 0; colIdx < matches.length; colIdx++) {
      const match = matches[colIdx];
      const content = match[1].trim(); // Extract content inside brackets
      
      if (content === '') {
        // Empty square
        board[rowIdx][colIdx] = null;
      } else {
        // Square with a piece
        board[rowIdx][colIdx] = content;
      }
    }
  }
  
  return board;
}

/**
 * Check if the terminal output contains a valid board representation
 */
export function containsBoard(terminalOutput: string): boolean {
  return terminalOutput.includes('Board:') &&
         terminalOutput.includes('P1 Start') &&
         terminalOutput.includes('P2 Start');
}

/**
 * Extract the most recent board from a terminal output string
 */
export function extractLatestBoard(terminalOutput: string): string {
  const lines = terminalOutput.split('\n');
  let lastBoardIndex = -1;
  
  // Find the last occurrence of "Board:"
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() === 'Board:') {
      lastBoardIndex = i;
      break;
    }
  }
  
  if (lastBoardIndex === -1) return ''; // No board found
  
  // Extract the board section (usually 5 lines including "Board:")
  const boardLines = lines.slice(lastBoardIndex, lastBoardIndex + 6);
  return boardLines.join('\n');
} 