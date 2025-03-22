class Game {
    constructor() {
        this.board = new Board();
        this.gameId = null;
        this.currentPlayer = 1;
        this.lastRoll = null;
        this.ws = null;

        // Bind event handlers
        document.getElementById('rollDice').addEventListener('click', () => this.rollDice());
        document.getElementById('newGame').addEventListener('click', () => this.createNewGame());

        // Create initial game
        this.createNewGame();
    }

    async createNewGame() {
        try {
            const response = await fetch('/api/games', {
                method: 'POST'
            });
            const data = await response.json();
            console.log('New game created:', data);  // Debug log
            this.gameId = '1';  // For now, hardcode to '1' since we're using simple ID generation
            this.setupWebSocket();
            this.updateGameState(data);
        } catch (error) {
            console.error('Error creating new game:', error);
        }
    }

    setupWebSocket() {
        if (this.ws) {
            this.ws.close();
        }

        if (!this.gameId) {
            console.error('No game ID available for WebSocket connection');
            return;
        }

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/ws/${this.gameId}`;
        console.log('Connecting to WebSocket:', wsUrl);  // Debug log
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onmessage = (event) => {
            console.log('WebSocket message received:', event.data);  // Debug log
            const data = JSON.parse(event.data);
            this.updateGameState(data);
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        this.ws.onclose = () => {
            console.log('WebSocket connection closed');
        };
    }

    async rollDice() {
        if (!this.gameId) {
            console.error('No game ID available');  // Debug log
            return;
        }

        try {
            console.log('Rolling dice for game:', this.gameId);  // Debug log
            const response = await fetch(`/api/games/${this.gameId}/roll`, {
                method: 'POST'
            });
            const data = await response.json();
            console.log('Roll response:', data);  // Debug log
            
            this.lastRoll = data.dice_result;
            document.getElementById('diceRoll').textContent = this.lastRoll;
            
            // Update valid moves
            if (data.valid_moves) {
                this.board.highlightValidMoves(data.valid_moves);
            }
            
            // Update game state
            this.updateGameState(data);
        } catch (error) {
            console.error('Error rolling dice:', error);
        }
    }

    async makeMove(piece, targetPosition) {
        if (!this.gameId || !this.lastRoll) return;

        try {
            const response = await fetch(`/api/games/${this.gameId}/move`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    game_id: this.gameId,
                    piece_id: piece.userData.pieceId,
                    player: this.currentPlayer
                })
            });
            const data = await response.json();
            this.updateGameState(data);
        } catch (error) {
            console.error('Error making move:', error);
        }
    }

    updateGameState(state) {
        console.log('Updating game state:', state);  // Debug log
        this.currentPlayer = state.current_player;
        document.getElementById('currentPlayer').textContent = this.currentPlayer;
        
        // Update pieces in hand and completed
        document.getElementById('p1Pieces').textContent = state.player1_pieces_in_hand;
        document.getElementById('p2Pieces').textContent = state.player2_pieces_in_hand;
        document.getElementById('p1Completed').textContent = state.player1_completed;
        document.getElementById('p2Completed').textContent = state.player2_completed;

        // Update dice roll display
        document.getElementById('diceRoll').textContent = state.dice_result || '-';

        // Update board visualization
        this.updateBoardVisualization(state.board);

        // Update valid moves
        if (state.valid_moves) {
            this.board.highlightValidMoves(state.valid_moves);
        } else {
            this.board.clearHighlights();
        }

        // Enable/disable controls based on current player
        document.getElementById('rollDice').disabled = 
            state.game_over || state.dice_result > 0;
    }

    updateBoardVisualization(boardState) {
        // Clear existing pieces
        [...this.board.pieces.player1, ...this.board.pieces.player2].forEach(piece => {
            this.board.scene.remove(piece);
        });
        this.board.pieces.player1 = [];
        this.board.pieces.player2 = [];

        // Add pieces based on new state
        for (let row = 0; row < boardState.length; row++) {
            for (let col = 0; col < boardState[row].length; col++) {
                const cell = boardState[row][col];
                if (cell === 1 || cell === 2) {
                    const piece = this.board.createPiece(cell, [row, col]);
                    this.board.pieces[`player${cell}`].push(piece);
                }
            }
        }
    }
} 