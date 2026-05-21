# HiChess Development Configuration

## Backend Configuration

BACKEND_HOST = "localhost"
BACKEND_PORT = 8000
BACKEND_RELOAD = True

## Frontend Configuration

API_BASE = "http://localhost:8000"
PLAYER_COLOR = "white"

## Chess AI Configuration

AI_TYPE = "stockfish"  # Options: stockfish, random
STOCKFISH_PATH = "/opt/homebrew/bin/stockfish"  # Path to Stockfish binary
STOCKFISH_TIME_LIMIT = 1.0  # Seconds per move
AI_DIFFICULTY = 1   # 1-10 (future)
