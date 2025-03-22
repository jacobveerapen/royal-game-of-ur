document.addEventListener('DOMContentLoaded', () => {
    // Initialize game
    const game = new Game();

    // Add keyboard controls for camera
    document.addEventListener('keydown', (event) => {
        const cameraSpeed = 0.5;
        const camera = game.board.camera;

        switch(event.key) {
            case 'ArrowUp':
                camera.position.z -= cameraSpeed;
                break;
            case 'ArrowDown':
                camera.position.z += cameraSpeed;
                break;
            case 'ArrowLeft':
                camera.position.x -= cameraSpeed;
                break;
            case 'ArrowRight':
                camera.position.x += cameraSpeed;
                break;
            case 'PageUp':
                camera.position.y += cameraSpeed;
                break;
            case 'PageDown':
                camera.position.y -= cameraSpeed;
                break;
            case 'r':
                // Reset camera position
                camera.position.set(0, 10, 10);
                camera.lookAt(0, 0, 0);
                break;
        }
    });
}); 