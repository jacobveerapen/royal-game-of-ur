# Rosette Image Instructions

To properly display the rosette tile image in the Royal Game of Ur:

1. Save the rosette flower image you provided to the following location:
   ```
   frontend/src/assets/images/rosette.png
   ```

2. Make sure the directory exists. If it doesn't, run:
   ```
   mkdir -p frontend/src/assets/images
   ```

3. The image should be saved as a PNG file named `rosette.png`.

4. After saving the image, you need to:
   - Build the frontend:
     ```
     cd frontend
     npm install
     npm run build
     ```
   - Start the server:
     ```
     python run_server.py
     ```

5. Open your browser and navigate to http://127.0.0.1:8000 to see the game board with the rosette image.

The code has been updated to use this image as a texture for all the rosette tiles on the game board. 