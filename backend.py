from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from chess import Board, Move, Piece, KING, QUEEN, ROOK, BISHOP, KNIGHT, PAWN, WHITE, BLACK
import chess.engine
import random
import os

app = FastAPI()

# Stockfish engine instance
engine = None
STOCKFISH_PATH = "/opt/homebrew/bin/stockfish"
STOCKFISH_TIME_LIMIT = 1.0  # seconds

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    global engine
    try:
        engine = chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH)
    except Exception as e:
        print(f"Warning: Failed to initialize Stockfish: {e}")
        engine = None

@app.on_event("shutdown")
async def shutdown_event():
    global engine
    if engine:
        engine.quit()

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
        {"fen": "8/8/4k3/8/8/4K3/R7/8 w - - 0 1", "difficulty": 1},
        {"fen": "8/8/8/3k4/8/4K3/6R1/8 w - - 0 1", "difficulty": 2},
        {"fen": "8/8/8/8/2k5/4K3/R7/8 w - - 0 1", "difficulty": 3},
    ],
    "queen_vs_king": [
        {"fen": "8/8/4k3/8/8/4K3/Q7/8 w - - 0 1", "difficulty": 1},
        {"fen": "8/8/8/3k4/8/4K3/6Q1/8 w - - 0 1", "difficulty": 2},
        {"fen": "8/8/8/8/2k5/4K3/Q7/8 w - - 0 1", "difficulty": 3},
    ],
    "bishop_vs_king": [
        {"fen": "8/8/4k3/8/8/4K3/B7/8 w - - 0 1", "difficulty": 1},
        {"fen": "8/8/8/3k4/8/4K3/6B1/8 w - - 0 1", "difficulty": 2},
        {"fen": "8/8/8/8/2k5/4K3/B7/8 w - - 0 1", "difficulty": 3},
    ],
    "knight_vs_king": [
        {"fen": "8/8/4k3/8/8/4K3/N7/8 w - - 0 1", "difficulty": 1},
        {"fen": "8/8/8/3k4/8/4K3/6N1/8 w - - 0 1", "difficulty": 2},
        {"fen": "8/8/8/8/2k5/4K3/N7/8 w - - 0 1", "difficulty": 3},
    ],
    "pawn_vs_king": [
        {"fen": "8/8/4k3/8/4P3/4K3/8/8 w - - 0 1", "difficulty": 1},
        {"fen": "8/8/8/3k4/8/4K2P/8/8 w - - 0 1", "difficulty": 2},
        {"fen": "8/8/8/8/2k3P1/4K3/8/8 w - - 0 1", "difficulty": 3},
    ],
}

def generate_random_endgame(rating: int = 1200):
    # Determine allowed difficulties by rating
    if rating < 1400:
        allowed_difficulties = [1, 2]
    else:
        allowed_difficulties = [1, 2, 3]

    # Pick random endgame type
    endgame_type = random.choice(list(ENDGAME_TEMPLATES.keys()))

    # Filter templates by difficulty
    filtered = [t for t in ENDGAME_TEMPLATES[endgame_type]
                if t["difficulty"] in allowed_difficulties]

    # Pick random from filtered templates
    template = random.choice(filtered)
    fen_template = template["fen"]
    board = Board(fen_template)

    player_color = random.choice([WHITE, BLACK])

    # If player is black, switch the turn
    if player_color == BLACK:
        parts = board.fen().split()
        parts[1] = 'b'
        board = Board(' '.join(parts))

    return {
        "fen": board.fen(),
        "type": endgame_type.replace("_", " "),
        "playerColor": "white" if player_color == WHITE else "black"
    }

def get_game_over_reason(board: Board) -> str:
    if board.is_checkmate():
        return "checkmate"
    elif board.is_stalemate():
        return "stalemate"
    elif board.is_insufficient_material():
        return "insufficient_material"
    elif board.is_seventyfive_moves():
        return "seventy_five_moves"
    elif board.is_fivefold_repetition():
        return "fivefold_repetition"
    elif board.is_game_over():
        return "draw"
    return "unknown"

def get_best_move_stockfish(fen: str) -> str:
    global engine

    if engine is None:
        # Fallback to random if Stockfish not available
        board = Board(fen)
        legal_moves = list(board.legal_moves)
        return random.choice(legal_moves).uci() if legal_moves else None

    try:
        board = Board(fen)
        info = engine.play(board, chess.engine.Limit(time=STOCKFISH_TIME_LIMIT))
        return info.move.uci()
    except Exception as e:
        print(f"Warning: Stockfish move failed: {e}, using random")
        board = Board(fen)
        legal_moves = list(board.legal_moves)
        return random.choice(legal_moves).uci() if legal_moves else None

@app.get("/")
def read_landing():
    with open('landing.html') as f:
        return HTMLResponse(f.read())

@app.get("/game")
def read_game():
    with open('main.html') as f:
        return HTMLResponse(f.read())

@app.get("/api/random-endgame")
def random_endgame(rating: int = 1200):
    return generate_random_endgame(rating)

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
                "result": board.result() if board.is_game_over() else None,
                "gameOverReason": get_game_over_reason(board) if board.is_game_over() else None
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

        # Get best move from Stockfish (or fallback to random)
        move_uci = get_best_move_stockfish(request.fen)
        if not move_uci:
            return {"error": "Could not find a move"}

        board.push(Move.from_uci(move_uci))

        return {
            "move": move_uci,
            "fen": board.fen(),
            "isGameOver": board.is_game_over(),
            "result": board.result() if board.is_game_over() else None,
            "gameOverReason": get_game_over_reason(board) if board.is_game_over() else None
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
