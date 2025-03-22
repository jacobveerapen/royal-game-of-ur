class Board {
    constructor() {
        this.squares = [];
        this.pieces = {
            player1: [],
            player2: []
        };
        this.selectedPiece = null;
        this.validMoves = [];
        this.rosettes = new Set([
            [0, 0], // P2 start rosette
            [0, 6], // P2 end rosette
            [1, 3], // Middle rosette
            [2, 0], // P1 start rosette
            [2, 6]  // P1 end rosette
        ]);

        // Initialize Three.js scene
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(800, 600); // Fixed size for game board
        this.renderer.setClearColor(0x2c3e50); // Dark blue-gray background
        
        // Add renderer to gameBoard div instead of body
        const gameBoard = document.getElementById('gameBoard');
        gameBoard.appendChild(this.renderer.domElement);

        // Add orbit controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2; // Limit vertical rotation
        
        // Set initial camera position for top-down view
        this.camera.position.set(0, 15, 10);
        this.camera.lookAt(0, 0, 0);

        // Add lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 5);
        this.scene.add(directionalLight);

        // Create board
        this.createBoard();

        // Start animation loop
        this.animate();

        // Add window resize handler
        window.addEventListener('resize', () => this.onWindowResize(), false);

        // Add click handler for piece selection
        this.renderer.domElement.addEventListener('click', (event) => this.onBoardClick(event), false);
    }

    createBoard() {
        // Define the H-shaped board layout
        const validSquares = new Set([
            // Player 2 path (top row)
            [0,0], [0,1], [0,2], [0,3], [0,6], [0,7],
            // Shared path (middle row)
            [1,0], [1,1], [1,2], [1,3], [1,4], [1,5], [1,6], [1,7],
            // Player 1 path (bottom row)
            [2,0], [2,1], [2,2], [2,3], [2,6], [2,7]
        ].map(pos => pos.join(',')));

        // Constants for board dimensions
        const squareSize = 1.2;
        const spacing = 0.2;
        const startX = -7;
        const startZ = -3.5;
        const baseThickness = 0.5;
        const borderWidth = 0.3;

        // Create H-shaped base sections
        const createBaseSection = (startCol, endCol, row) => {
            const width = (endCol - startCol + 1) * (squareSize + spacing) - spacing + borderWidth * 2;
            const depth = squareSize + borderWidth * 2;
            const geometry = new THREE.BoxGeometry(width, baseThickness, depth);
            const material = new THREE.MeshPhongMaterial({ 
                color: 0x4a3728,  // Dark brown
                roughness: 0.8
            });
            const section = new THREE.Mesh(geometry, material);
            
            // Position the section
            const x = startX + (startCol + (endCol - startCol) / 2) * (squareSize + spacing);
            const z = startZ + row * (squareSize + spacing);
            section.position.set(x, 0, z);
            
            return section;
        };

        // Create the three horizontal sections of the H
        const topSection = createBaseSection(0, 3, 0);    // Top row (0-3)
        const middleSection = createBaseSection(0, 7, 1);  // Middle row (full width)
        const bottomSection = createBaseSection(0, 3, 2);  // Bottom row (0-3)
        const topRightSection = createBaseSection(6, 7, 0);    // Top right (6-7)
        const bottomRightSection = createBaseSection(6, 7, 2);  // Bottom right (6-7)

        // Add all sections to the scene
        this.scene.add(topSection);
        this.scene.add(middleSection);
        this.scene.add(bottomSection);
        this.scene.add(topRightSection);
        this.scene.add(bottomRightSection);

        // Create squares
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 8; col++) {
                if (!validSquares.has(`${row},${col}`)) continue;

                const x = startX + col * (squareSize + spacing);
                const z = startZ + row * (squareSize + spacing);

                // Create square with border
                const squareGroup = new THREE.Group();

                // Inner square (main part)
                const innerGeometry = new THREE.BoxGeometry(squareSize, 0.1, squareSize);
                const isRosette = this.rosettes.has([row, col]);
                const squareMaterial = new THREE.MeshPhongMaterial({
                    color: isRosette ? 0xd4af37 : 0xf5deb3, // Gold for rosettes, wheat for normal squares
                    roughness: 0.5
                });

                const innerSquare = new THREE.Mesh(innerGeometry, squareMaterial);

                // Border
                const borderGeometry = new THREE.BoxGeometry(squareSize + 0.1, 0.12, squareSize + 0.1);
                const borderMaterial = new THREE.MeshPhongMaterial({
                    color: 0x2c1810, // Dark brown border
                    roughness: 0.7
                });

                const border = new THREE.Mesh(borderGeometry, borderMaterial);
                border.position.y = -0.01;

                squareGroup.add(border);
                squareGroup.add(innerSquare);
                squareGroup.position.set(x, 0.3, z);
                this.scene.add(squareGroup);

                // If it's a rosette, add decorative pattern
                if (isRosette) {
                    const rosetteGeometry = new THREE.CircleGeometry(squareSize/3, 8);
                    const rosetteMaterial = new THREE.MeshPhongMaterial({
                        color: 0x8b4513,
                        side: THREE.DoubleSide
                    });
                    const rosette = new THREE.Mesh(rosetteGeometry, rosetteMaterial);
                    rosette.rotation.x = -Math.PI/2;
                    rosette.position.y = 0.06;
                    squareGroup.add(rosette);
                }

                this.squares.push({
                    mesh: squareGroup,
                    position: [row, col],
                    isRosette: isRosette
                });
            }
        }
    }

    createPiece(player, position) {
        const pieceGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.2, 32);
        const pieceMaterial = new THREE.MeshPhongMaterial({
            color: player === 1 ? 0x8b0000 : 0x00008b, // Dark red for P1, dark blue for P2
            metalness: 0.5,
            roughness: 0.5
        });
        const piece = new THREE.Mesh(pieceGeometry, pieceMaterial);

        const square = this.squares.find(s => 
            s.position[0] === position[0] && s.position[1] === position[1]
        );

        if (square) {
            piece.position.copy(square.mesh.position);
            piece.position.y += 0.2;
        }

        piece.userData.pieceId = piece.id;
        piece.userData.player = player;

        this.scene.add(piece);
        return piece;
    }

    highlightValidMoves(moves) {
        this.clearHighlights();
        this.validMoves = moves;

        moves.forEach(move => {
            const square = this.squares.find(s => 
                s.position[0] === move[0] && s.position[1] === move[1]
            );
            if (square) {
                square.mesh.children.forEach(child => {
                    if (child instanceof THREE.Mesh) {
                        child.material.color.setHex(0x00ff00);
                    }
                });
            }
        });
    }

    clearHighlights() {
        this.squares.forEach(square => {
            square.mesh.children.forEach(child => {
                if (child instanceof THREE.Mesh) {
                    child.material.color.setHex(
                        square.isRosette ? 0xFFD700 : 0xDEB887
                    );
                }
            });
        });
        this.validMoves = [];
    }

    onBoardClick(event) {
        event.preventDefault();

        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, this.camera);

        // Check for piece intersection
        const pieceIntersects = raycaster.intersectObjects([
            ...this.pieces.player1,
            ...this.pieces.player2
        ]);

        if (pieceIntersects.length > 0) {
            const clickedPiece = pieceIntersects[0].object;
            this.selectPiece(clickedPiece);
            return;
        }

        // Check for square intersection when a piece is selected
        if (this.selectedPiece) {
            const squareIntersects = raycaster.intersectObjects(
                this.squares.map(s => s.mesh)
            );

            if (squareIntersects.length > 0) {
                const clickedSquare = this.squares.find(s => 
                    s.mesh === squareIntersects[0].object
                );
                
                if (this.validMoves.some(move => 
                    move[0] === clickedSquare.position[0] && 
                    move[1] === clickedSquare.position[1]
                )) {
                    this.movePiece(this.selectedPiece, clickedSquare.position);
                }
            }
        }
    }

    selectPiece(piece) {
        if (this.selectedPiece) {
            this.selectedPiece.material.emissive.setHex(0x000000);
        }

        this.selectedPiece = piece;
        piece.material.emissive.setHex(0x555555);
    }

    movePiece(piece, targetPosition) {
        const targetSquare = this.squares.find(s => 
            s.position[0] === targetPosition[0] && 
            s.position[1] === targetPosition[1]
        );

        if (targetSquare) {
            piece.position.copy(targetSquare.mesh.position);
            piece.position.y += 0.2;
        }

        this.selectedPiece = null;
        this.clearHighlights();
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
} 