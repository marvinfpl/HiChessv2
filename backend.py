from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from chess import Board, Move, Piece, KING, QUEEN, ROOK, BISHOP, KNIGHT, PAWN, WHITE, BLACK
import random
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files
if os.path.isdir("css"):
    app.mount("/css", StaticFiles(directory="css"), name="css")
if os.path.isdir("js"):
    app.mount("/js", StaticFiles(directory="js"), name="js")
if os.path.isdir("img"):
    app.mount("/img", StaticFiles(directory="img"), name="img")

class MoveRequest(BaseModel):
    fen: str
    from_square: str
    to_square: str

class AIRequest(BaseModel):
    fen: str

# Endgame generator
ENDGAME_TEMPLATES = {
    "rook_vs_king": [
        "8/8/4k3/8/8/4K3/R7 w - - 0 1",
        "8/8/8/3k4/8/4K3/6R1 w - - 0 1",
        "8/8/8/8/2k5/4K3/R7 w - - 0 1",
    ],
    "queen_vs_king": [
        "8/8/4k3/8/8/4K3/Q7 w - - 0 1",
        "8/8/8/3k4/8/4K3/6Q1 w - - 0 1",
        "8/8/8/8/2k5/4K3/Q7 w - - 0 1",
    ],
    "bishop_vs_king": [
        "8/8/4k3/8/8/4K3/B7 w - - 0 1",
        "8/8/8/3k4/8/4K3/6B1 w - - 0 1",
        "8/8/8/8/2k5/4K3/B7 w - - 0 1",
    ],
    "knight_vs_king": [
        "8/8/4k3/8/8/4K3/N7 w - - 0 1",
        "8/8/8/3k4/8/4K3/6N1 w - - 0 1",
        "8/8/8/8/2k5/4K3/N7 w - - 0 1",
    ],
    "pawn_vs_king": [
        "8/8/4k3/8/4P3/4K3/8 w - - 0 1",
        "8/8/8/3k4/8/4K2P/8 w - - 0 1",
        "8/8/8/8/2k3P1/4K3/8 w - - 0 1",
    ],
}

def generate_random_endgame():
    endgame_type = random.choice(list(ENDGAME_TEMPLATES.keys()))
    fen_template = random.choice(ENDGAME_TEMPLATES[endgame_type])
    board = Board(fen_template)

    player_color = random.choice([WHITE, BLACK])

    # If player is black, switch the turn (fen already has "w", we need "b")
    if player_color == BLACK:
        # Extract FEN parts and swap the turn
        parts = board.fen().split()
        parts[1] = 'b'
        board = Board(' '.join(parts))

    return {
        "fen": board.fen(),
        "type": endgame_type.replace("_", " "),
        "playerColor": "white" if player_color == WHITE else "black"
    }

@app.get("/")
def read_landing():
    with open('landing.html') as f:
        return HTMLResponse(f.read())

@app.get("/game")
def read_game():
    with open('main.html') as f:
        return HTMLResponse(f.read())

@app.get("/api/random-endgame")
def random_endgame():
    return generate_random_endgame()

@app.post("/api/validate-move")
def validate_move(request: MoveRequest):
    try:
        board = Board(request.fen)
        move = Move.from_uci(request.from_square + request.to_square)

        if move in board.legal_moves:
            board.push(move)
            return {
                "valid": True,
                "fen": board.fen(),
                "isGameOver": board.is_game_over(),
                "result": board.result() if board.is_game_over() else None
            }
        else:
            raise HTTPException(status_code=400, detail="Illegal move")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/ai-move")
def get_ai_move(request: AIRequest):
    try:
        board = Board(request.fen)

        if board.is_game_over():
            return {"error": "Game is over"}

        legal_moves = list(board.legal_moves)
        if not legal_moves:
            return {"error": "No legal moves"}

        # Simple random AI
        move = random.choice(legal_moves)
        board.push(move)

        return {
            "move": move.uci(),
            "fen": board.fen(),
            "isGameOver": board.is_game_over(),
            "result": board.result() if board.is_game_over() else None
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

