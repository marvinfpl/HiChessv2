import { Chessground } from 'https://cdn.jsdelivr.net/npm/@lichess-org/chessground@10.1.0/+esm';
import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm';

const API_BASE = location.origin;
const chess = new Chess();
let ground;
let playerColor = 'white';
let gameActive = false;
let moveCount = 0;
let moveHistory = [];
let currentEndgameType = null;
let selectedEndgameType = null;

// Rating system
let playerRating = JSON.parse(localStorage.getItem('playerRating')) || 1200;
let ratingHistory = JSON.parse(localStorage.getItem('ratingHistory')) || [];
const AI_RATING = 1800;

// DOM Elements
const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const fenEl = document.getElementById('fenDisplay');
const moveCountEl = document.getElementById('moveCount');
const newEndgameBtn = document.getElementById('newEndgameBtn');
const undoBtn = document.getElementById('undoBtn');
const resignBtn = document.getElementById('resignBtn');
const copyFenBtn = document.getElementById('copyFenBtn');
const endgameDashboard = document.getElementById('endgameDashboard');
const gamePanel = document.getElementById('gamePanel');
const resultBox = document.getElementById('resultBox');
const playerIndicator = document.getElementById('playerIndicator');
const randomEndgameBtn = document.getElementById('randomEndgameBtn');

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

    gameActive = false;
    updateRatingDisplay(change);
    updateBoard();
}

function updateRatingDisplay(delta) {
    const sign = delta >= 0 ? '+' : '';
    const ratingDisplay = document.getElementById('ratingDisplay');
    if (ratingDisplay) {
        ratingDisplay.textContent = `Rating: ${playerRating} (${sign}${delta})`;
        setTimeout(() => {
            ratingDisplay.textContent = `Rating: ${playerRating}`;
        }, 3000);
    }
}

function updateStatus() {
    if (chess.isCheckmate()) {
        const losingColor = chess.turn() === 'w' ? 'white' : 'black';
        const result = playerColor === losingColor ? 'loss' : 'win';
        const winner = losingColor === 'white' ? 'Black' : 'White';

        resultBox.style.display = 'block';
        resultBox.textContent = `Checkmate! ${winner} wins!`;
        statusEl.textContent = `✓ ${winner} wins!`;

        endGame(result);
    } else if (chess.isDraw()) {
        resultBox.style.display = 'block';
        resultBox.textContent = 'Draw!';
        statusEl.textContent = '= Draw!';
        endGame('draw');
    } else if (chess.isStalemate()) {
        resultBox.style.display = 'block';
        resultBox.textContent = 'Stalemate! Draw.';
        statusEl.textContent = '= Stalemate! Draw.';
        endGame('draw');
    } else if (chess.isInsufficientMaterial()) {
        resultBox.style.display = 'block';
        resultBox.textContent = 'Insufficient material! Draw.';
        statusEl.textContent = '= Insufficient material! Draw.';
        endGame('draw');
    } else if (chess.isThreefoldRepetition()) {
        resultBox.style.display = 'block';
        resultBox.textContent = 'Threefold repetition! Draw.';
        statusEl.textContent = '= Threefold repetition! Draw.';
        endGame('draw');
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
    if (!gameActive) return;

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
    gameActive = false;
    ground.set({ fen: chess.fen() });
    updateBoard();
}

function undoLastMove() {
    if (moveHistory.length > 0) {
        moveHistory.pop();
        chess.undo();
        moveCount--;
        updateBoard();

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
    resultBox.style.display = 'block';
    resultBox.textContent = `${winner} wins! (You resigned)`;
    statusEl.textContent = `${winner} wins! (You resigned)`;
}

async function loadEndgame(endgameType = null) {
    try {
        let url = `${API_BASE}/api/random-endgame?rating=${playerRating}`;
        if (endgameType) {
            url += `&type=${endgameType}`;
        }

        const res = await fetch(url);
        const data = await res.json();

        chess.load(data.fen);
        playerColor = data.playerColor;
        currentEndgameType = data.type;

        moveHistory = [];
        moveCount = 0;
        gameActive = true;
        resultBox.style.display = 'none';

        // Update UI
        ground.set({ orientation: playerColor });
        updateBoard();

        // Show game panel, hide dashboard
        endgameDashboard.style.display = 'none';
        gamePanel.style.display = 'flex';

        // Update player indicator
        playerIndicator.textContent = `You (${playerColor === 'white' ? 'White' : 'Black'})`;

        // If player is black, AI plays first
        if (playerColor === 'black' && gameActive) {
            setTimeout(playAI, 500);
        }
    } catch (e) {
        console.error('Failed to load endgame:', e);
        alert('Failed to load endgame. Try again.');
    }
}

function showDashboard() {
    endgameDashboard.style.display = 'block';
    gamePanel.style.display = 'none';
    resetGame();
}

// Initialize board
ground = Chessground(boardEl, {
    fen: chess.fen(),
    orientation: 'white',
    coordinates: true,
    movable: {
        free: false,
        color: 'white',
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

// Event listeners - Game Controls
newEndgameBtn.addEventListener('click', showDashboard);
undoBtn.addEventListener('click', undoLastMove);
resignBtn.addEventListener('click', () => {
    if (confirm(`Are you sure? ${playerColor} will resign.`)) {
        resign();
    }
});
copyFenBtn.addEventListener('click', copyFEN);

// Event listeners - Endgame Selection
document.querySelectorAll('.endgame-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const type = btn.dataset.type;
        if (type === undefined) {
            // Random button
            loadEndgame();
        } else {
            loadEndgame(type);
        }
    });
});

randomEndgameBtn.addEventListener('click', () => {
    loadEndgame();
});

// Initialize rating display
const ratingDisplay = document.getElementById('ratingDisplay');
if (ratingDisplay) {
    ratingDisplay.textContent = `Rating: ${playerRating}`;
}

// Show dashboard on startup
endgameDashboard.style.display = 'block';
gamePanel.style.display = 'none';

updateBoard();
