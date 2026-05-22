import { Chessground } from 'https://cdn.jsdelivr.net/npm/@lichess-org/chessground@10.1.0/+esm';
import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm';

const API_BASE = location.origin;
const chess = new Chess();
let ground;
let playerColor = 'white';
let gameActive = true;
let moveCount = 0;
let moveHistory = [];
let currentEndgameType = null;
let isEndgameMode = false;

// Rating system
let playerRating = JSON.parse(localStorage.getItem('playerRating')) || 1200;
let ratingHistory = JSON.parse(localStorage.getItem('ratingHistory')) || [];
const AI_RATING = 1800;

const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const fenEl = document.getElementById('fenDisplay');
const moveCountEl = document.getElementById('moveCount');
const newGameBtn = document.getElementById('newGameBtn');
const undoBtn = document.getElementById('undoBtn');
const resetBtn = document.getElementById('resetBtn');
const copyFenBtn = document.getElementById('copyFenBtn');
const gameModeModal = document.getElementById('gameModeModal');
const standardGameBtn = document.getElementById('standardGameBtn');
const endgameBtn = document.getElementById('endgameBtn');
const newEndgameBtn = document.getElementById('newEndgameBtn');
const endgameTypeEl = document.getElementById('endgameType');
const endgameTypeTextEl = document.getElementById('endgameTypeText');
const resignBtn = document.getElementById('resignBtn');

function calculateEloChange(result) {
    const K = 32;
    const resultValue = result === 'win' ? 1.0 : (result === 'loss' ? 0.0 : 0.5);
    const expected = 1 / (1 + Math.pow(10, (AI_RATING - playerRating) / 400));
    return Math.round(K * (resultValue - expected));
}

function endGame(result) {
    if (!gameActive) return;

    const change = calculateEloChange(result);
    const oldRating = playerRating;
    playerRating += change;

    localStorage.setItem('playerRating', JSON.stringify(playerRating));
    ratingHistory.push({
        date: new Date().toISOString(),
        type: currentEndgameType,
        result,
        ratingBefore: oldRating,
        ratingAfter: playerRating
    });
    localStorage.setItem('ratingHistory', JSON.stringify(ratingHistory));

    updateRatingDisplay(change);
    gameActive = false;
}

function updateRatingDisplay(delta) {
    const sign = delta >= 0 ? '+' : '';
    const ratingDisplay = document.getElementById('ratingDisplay');
    if (ratingDisplay) {
        ratingDisplay.textContent = `Rating: ${playerRating} (${sign}${delta})`;
    }
}

function buildDests() {
    const dests = new Map();
    for (const move of chess.moves({ verbose: true })) {
        const from = move.from;
        if (!dests.has(from)) dests.set(from, []);
        dests.get(from).push(move.to);
    }
    return dests;
}

function findKingSquare(board, isWhite) {
    const fen = board.fen();
    const position = fen.split(' ')[0];
    const king = isWhite ? 'K' : 'k';

    let square = '';
    let file = 0;
    let rank = 8;

    for (const char of position) {
        if (char === '/') {
            file = 0;
            rank--;
        } else if (/\d/.test(char)) {
            file += parseInt(char);
        } else {
            square = String.fromCharCode(97 + file) + rank;
            if (char === king) return square;
            file++;
        }
    }
    return undefined;
}

function updateBoard() {
    const turn = chess.turn() === 'w' ? 'white' : 'black';
    const kingSquare = chess.inCheck() ? findKingSquare(chess, chess.turn() === 'w') : undefined;

    ground.set({
        fen: chess.fen(),
        turnColor: turn,
        check: kingSquare,
        movable: {
            color: gameActive && turn === playerColor ? playerColor : undefined,
            dests: gameActive ? buildDests() : new Map(),
            showDests: true,
        },
        draggable: { enabled: gameActive },
        viewOnly: !gameActive,
    });

    updateStatus();
    updateFEN();
}

function updateStatus() {
    if (chess.isCheckmate()) {
        const losingColor = chess.turn() === 'w' ? 'white' : 'black';
        const result = playerColor === losingColor ? 'loss' : 'win';
        endGame(result);
        statusEl.textContent = `✓ Checkmate! ${losingColor === 'white' ? 'Black' : 'White'} wins!`;
        gameActive = false;
    } else if (chess.isDraw()) {
        endGame('draw');
        statusEl.textContent = '= Draw!';
        gameActive = false;
    } else if (chess.isStalemate()) {
        endGame('draw');
        statusEl.textContent = '= Stalemate! Draw.';
        gameActive = false;
    } else if (chess.isInsufficientMaterial()) {
        endGame('draw');
        statusEl.textContent = '= Insufficient material! Draw.';
        gameActive = false;
    } else if (chess.isThreefoldRepetition()) {
        endGame('draw');
        statusEl.textContent = '= Threefold repetition! Draw.';
        gameActive = false;
    } else if (chess.inCheck()) {
        statusEl.textContent = `⚠ ${chess.turn() === 'w' ? 'White' : 'Black'} is in check!`;
    } else {
        statusEl.textContent = `${chess.turn() === 'w' ? '⚪' : '⚫'} ${chess.turn() === 'w' ? 'White' : 'Black'} to move`;
    }

    moveCountEl.textContent = Math.floor(moveCount / 2);
    undoBtn.disabled = moveHistory.length === 0;
}

function updateFEN() {
    fenEl.value = chess.fen();
}

function makeMove(from, to) {
    const move = chess.move({ from, to, promotion: 'q' });
    if (move) {
        moveHistory.push(move);
        moveCount++;
        updateBoard();
        if (chess.turn() !== playerColor && gameActive && !chess.isGameOver()) {
            setTimeout(playAI, 500);
        }
    }
}

async function playAI() {
    if (!gameActive || chess.turn() === 'w') return;

    try {
        const res = await fetch(`${API_BASE}/api/ai-move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fen: chess.fen() })
        });

        const data = await res.json();
        if (data.move) {
            const move = data.move;
            const moveObj = chess.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: 'q' });
            if (moveObj) {
                moveHistory.push(moveObj);
                moveCount++;
                updateBoard();
            }
        }
    } catch (e) {
        console.error('AI move failed:', e);
    }
}

function resetGame() {
    chess.reset();
    moveHistory = [];
    moveCount = 0;
    gameActive = true;
    ground.set({ fen: chess.fen() });
    updateBoard();
}

function undoLastMove() {
    if (moveHistory.length > 0) {
        moveHistory.pop();
        chess.undo();
        moveCount--;
        updateBoard();

        // If the last move was by AI, undo that too
        if (moveHistory.length > 0 && chess.turn() === 'w') {
            moveHistory.pop();
            chess.undo();
            moveCount--;
            updateBoard();
        }
    }
}

function copyFEN() {
    navigator.clipboard.writeText(chess.fen()).then(() => {
        const originalText = copyFenBtn.textContent;
        copyFenBtn.textContent = '✓ Copied!';
        setTimeout(() => {
            copyFenBtn.textContent = originalText;
        }, 2000);
    });
}

function resign() {
    if (!gameActive) return;
    const winner = playerColor === 'white' ? 'Black' : 'White';
    endGame('loss');
    statusEl.textContent = `${winner} wins! (${playerColor} resigned)`;
}

async function loadRandomEndgame() {
    try {
        const res = await fetch(`${API_BASE}/api/random-endgame?rating=${playerRating}`);
        const data = await res.json();

        chess.load(data.fen);
        playerColor = data.playerColor;
        currentEndgameType = data.type;
        isEndgameMode = true;

        moveHistory = [];
        moveCount = 0;
        gameActive = true;

        // Update board orientation
        ground.set({ orientation: playerColor });
        updateBoard();

        // Show endgame info and new endgame button
        endgameTypeEl.style.display = 'block';
        endgameTypeTextEl.textContent = `${data.type} - You play ${playerColor}`;
        newEndgameBtn.style.display = 'block';
        newGameBtn.style.display = 'none';

        // If player is black, AI plays first
        if (playerColor === 'black' && gameActive) {
            setTimeout(playAI, 500);
        }
    } catch (e) {
        console.error('Failed to load endgame:', e);
        alert('Failed to load endgame. Try again.');
    }
}

function startStandardGame() {
    isEndgameMode = false;
    playerColor = 'white';
    currentEndgameType = null;

    chess.reset();
    moveHistory = [];
    moveCount = 0;
    gameActive = true;

    ground.set({ orientation: playerColor });
    updateBoard();

    // Hide endgame info and new endgame button
    endgameTypeEl.style.display = 'none';
    newEndgameBtn.style.display = 'none';
    newGameBtn.style.display = 'block';
}

// Initialize board
ground = Chessground(boardEl, {
    fen: chess.fen(),
    orientation: playerColor,
    coordinates: true,
    movable: {
        free: false,
        color: playerColor,
        dests: buildDests(),
        showDests: true,
    },
    draggable: { enabled: true },
    events: {
        move: (from, to) => {
            makeMove(from, to);
        }
    }
});

// Event listeners
newGameBtn.addEventListener('click', resetGame);
undoBtn.addEventListener('click', undoLastMove);
resetBtn.addEventListener('click', () => {
    if (confirm('Are you sure? This will reset the game.')) {
        resetGame();
    }
});
copyFenBtn.addEventListener('click', copyFEN);
resignBtn.addEventListener('click', () => {
    if (confirm(`Are you sure? ${playerColor} will resign.`)) {
        resign();
    }
});

// Modal event listeners
standardGameBtn.addEventListener('click', () => {
    gameModeModal.style.display = 'none';
    startStandardGame();
});

endgameBtn.addEventListener('click', () => {
    gameModeModal.style.display = 'none';
    loadRandomEndgame();
});

newEndgameBtn.addEventListener('click', loadRandomEndgame);

// Show modal on startup
gameModeModal.style.display = 'flex';

// Initialize rating display
const ratingDisplay = document.getElementById('ratingDisplay');
if (ratingDisplay) {
    ratingDisplay.textContent = `Rating: ${playerRating}`;
}

updateBoard();