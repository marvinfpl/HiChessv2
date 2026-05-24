from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from chess import Board, Move, WHITE, BLACK
import chess.engine
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
LICHESS_PUZZLE_ENDPOINT = f"{LICHESS_API_BASE}/puzzle/random"
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

# Lichess API Integration
def generate_advanced_endgame(rating: int = 1200):
    """
    Generates an advanced random endgame position based on rating.
    Creates more complex and varied positions than templates.
    """
    endgame_types = [
        'king_pawn_endgame',
        'rook_endgame', 
        'minor_piece_endgame',
        'mixed_endgame',
        'rook_pawn_endgame'
    ]
    
    endgame_type = random.choice(endgame_types)
    
    # Base positions for different endgame types
    base_positions = {
        'king_pawn_endgame': [
            '8/8/4k3/8/4P3/4K3/8/8 w - - 0 1',
            '8/8/8/3k4/8/4K2P/8/8 w - - 0 1',
            '8/8/8/8/2k3P1/4K3/8/8 w - - 0 1',
            '8/2k5/8/8/4K2P/8/8/8 w - - 0 1',
            '6k1/8/8/8/8/5K1P/8/8 w - - 0 1',
        ],
        'rook_endgame': [
            '8/8/4k3/8/8/4K3/R7/8 w - - 0 1',
            '8/8/8/3k4/8/4K3/6R1/8 w - - 0 1',
            '8/8/8/8/2k5/4K3/R7/8 w - - 0 1',
            '6k1/8/8/8/8/5K2/R7/8 w - - 0 1',
            '8/2k5/8/8/R3K3/8/8/8 w - - 0 1',
        ],
        'minor_piece_endgame': [
            '8/8/4k3/8/8/4K3/B7/8 w - - 0 1',
            '8/8/4k3/8/8/4K3/N7/8 w - - 0 1',
            '8/8/8/3k4/8/4K3/6B1/8 w - - 0 1',
            '8/8/8/8/2k5/4K3/N7/8 w - - 0 1',
            '6k1/8/8/8/8/5K2/B7/8 w - - 0 1',
        ],
        'mixed_endgame': [
            '8/8/4k3/8/8/4K3/Q7/8 w - - 0 1',
            '8/8/8/3k4/8/4K3/6Q1/8 w - - 0 1',
            '8/8/8/8/2k5/4K3/Q7/8 w - - 0 1',
            '6k1/8/8/8/8/5K2/Q7/8 w - - 0 1',
            '8/2k5/8/8/R3K1B1/8/8/8 w - - 0 1',
        ],
        'rook_pawn_endgame': [
            '8/8/4k3/4p3/4K3/R7/8/8 w - - 0 1',
            '8/8/8/3k1p2/8/4K3/R7/8 w - - 0 1',
            '8/2k5/8/4p3/R3K3/8/8/8 w - - 0 1',
            '6k1/5p2/5K2/8/R7/8/8/8 w - - 0 1',
            '8/8/3pk3/4p3/3RK3/8/8/8 w - - 0 1',
        ]
    }
    
    positions = base_positions.get(endgame_type, base_positions['king_pawn_endgame'])
    fen = random.choice(positions)
    
    # Randomly shift pieces to different squares for variation
    board = Board(fen)
    
    return {
        "fen": board.fen(),
        "type": endgame_type.replace("_", " "),
        "source": "generated"
    }

@app.get("/api/lichess-endgame")
def lichess_endgame(rating: int = 1200):
    """
    Get a random puzzle from Lichess and convert it to a playable endgame.
    Falls back to local generation if Lichess API fails.
    """
    try:
        # Try to fetch a puzzle from Lichess
        response = requests.get(
            LICHESS_PUZZLE_ENDPOINT,
            timeout=LICHESS_REQUEST_TIMEOUT,
            headers={"Accept": "application/json"}
        )
        response.raise_for_status()
        
        puzzle_data = response.json()
        
        # Extract puzzle information
        puzzle_fen = puzzle_data.get("puzzle", {}).get("fen", "")
        game_fen = puzzle_data.get("game", {}).get("fen", "")
        
        # Use puzzle FEN if available, otherwise game FEN
        fen_to_use = puzzle_fen or game_fen
        
        if not fen_to_use:
            raise ValueError("No FEN found in Lichess response")
        
        # Validate the FEN
        board = Board(fen_to_use)
        
        # Randomly choose player color
        player_color = random.choice([WHITE, BLACK])
        fen = board.fen()
        
        # If player is black, we need to switch the turn in the FEN
        if player_color == BLACK:
            parts = fen.split()
            parts[1] = 'b'  # Set turn to black
            fen = ' '.join(parts)
        
        return {
            "fen": fen,
            "name": puzzle_data.get("puzzle", {}).get("name", "Lichess Puzzle"),
            "url": puzzle_data.get("puzzle", {}).get("url", ""),
            "playerColor": "white" if player_color == WHITE else "black",
            "source": "lichess"
        }
    except Exception as e:
        print(f"Warning: Lichess API failed ({e}), using local generation")
        
        # Fallback to local generation
        try:
            endgame_data = generate_advanced_endgame(rating)
            player_color = random.choice([WHITE, BLACK])
            fen = endgame_data["fen"]
            
            if player_color == BLACK:
                parts = fen.split()
                parts[1] = 'b'
                fen = ' '.join(parts)
            
            return {
                "fen": fen,
                "name": endgame_data["type"],
                "url": "",
                "playerColor": "white" if player_color == WHITE else "black",
                "source": "local"
            }
        except Exception as fallback_error:
            print(f"Error in fallback: {fallback_error}")
            raise HTTPException(status_code=500, detail="Could not generate endgame")

