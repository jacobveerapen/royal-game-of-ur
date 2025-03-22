import uvicorn

if __name__ == "__main__":
    uvicorn.run("backend.ur_game.web.main:app", host="127.0.0.1", port=8000, reload=True) 