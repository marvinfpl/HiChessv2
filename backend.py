from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from chess import Board, Move, WHITE, BLACK
import chess.engine
import chess.pgn
import io
import random
import os
import requests

app = FastAPI()

# Stockfish engine instance
engine = None
STOCKFISH_PATH = "/opt/homebrew/bin/stockfish"
STOCKFISH_TIME_LIMIT = 1.0  # seconds

# Lichess API Configuration
LICHESS_API_BASE = "https://lichess.org/api"
LICHESS_PUZZLE_ENDPOINT = f"{LICHESS_API_BASE}/puzzle/next"
LICHESS_REQUEST_TIMEOUT = 5  # seconds

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
    

def get_puzzle_fen_from_response(puzzle_data):
    game_pgn = puzzle_data.get("game", {}).get("pgn", "")
    initial_ply = puzzle_data.get("puzzle", {}).get("initialPly")

    if not game_pgn or initial_ply is None:
        raise ValueError("Invalid Lichess puzzle response: missing PGN or initial ply")

    game = chess.pgn.read_game(io.StringIO(game_pgn))
    if game is None:
        raise ValueError("Could not parse PGN from Lichess response")

    board = game.board()
    ply_to_replay = int(initial_ply) - 1
    if ply_to_replay < 0:
        raise ValueError("Invalid initial ply")

    for i, move in enumerate(game.mainline_moves(), start=1):
        if i > ply_to_replay:
            break
        board.push(move)

    return board.fen()

@app.get("/api/lichess-endgame")
def lichess_endgame():
    """
    Get a random puzzle from Lichess and return an endgame position.
    The player is assigned White or Black with a 50/50 chance.
    """
    target_color = random.choice([WHITE, BLACK])
    max_attempts = 8

    for attempt in range(max_attempts):
        try:
            response = requests.get(
                LICHESS_PUZZLE_ENDPOINT,
                timeout=LICHESS_REQUEST_TIMEOUT,
                headers={"Accept": "application/json"}
            )
            response.raise_for_status()

            puzzle_data = response.json()
            fen = get_puzzle_fen_from_response(puzzle_data)
            board = Board(fen)

            if board.turn != target_color:
                if attempt == max_attempts - 1:
                    raise ValueError("Could not find a puzzle matching the selected color")
                continue

            puzzle_id = puzzle_data.get("puzzle", {}).get("id", "")
            puzzle_url = f"https://lichess.org/training/{puzzle_id}" if puzzle_id else ""
            player_color = "white" if target_color == WHITE else "black"

            return {
                "fen": board.fen(),
                "name": puzzle_data.get("game", {}).get("perf", {}).get("name", "Lichess Puzzle"),
                "url": puzzle_url,
                "playerColor": player_color,
                "source": "lichess",
                "solution": puzzle_data.get("puzzle", {}).get("solution", []),
                "themes": puzzle_data.get("puzzle", {}).get("themes", []),
                "rating": puzzle_data.get("puzzle", {}).get("rating"),
                "pgn": puzzle_data.get("game", {}).get("pgn", "")
            }
        except Exception as e:
            if attempt == max_attempts - 1:
                raise HTTPException(status_code=502, detail=f"Lichess API failed: {e}")

    raise HTTPException(status_code=502, detail="Could not fetch a Lichess puzzle for the chosen color")
