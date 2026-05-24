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
let currentNavPosition = 0; // Track which move we're viewing
let initialFEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'; // Initial FEN of endgame

// Rating system
let playerRating = JSON.parse(localStorage.getItem('playerRating')) || 1200;
let ratingHistory = JSON.parse(localStorage.getItem('ratingHistory')) || [];
const AI_RATING = 1800;

// DOM Elements
const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const moveCountEl = document.getElementById('moveCount');
const movesList = document.getElementById('movesList');
const newEndgameBtn = document.getElementById('newEndgameBtn');
const undoBtn = document.getElementById('undoBtn');
const resignBtn = document.getElementById('resignBtn');
const endgameDashboard = document.getElementById('endgameDashboard');
const gamePanel = document.getElementById('gamePanel');
const resultBox = document.getElementById('resultBox');
const playerIndicator = document.getElementById('playerIndicator');
const startGameBtn = document.getElementById('startGameBtn');
const firstMoveBtn = document.getElementById('firstMoveBtn');
const prevMoveBtn = document.getElementById('prevMoveBtn');
const nextMoveBtn = document.getElementById('nextMoveBtn');
const lastMoveBtn = document.getElementById('lastMoveBtn');

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
}

function updateMovesList() {
    if (moveHistory.length === 0) {
        movesList.innerHTML = '<div class="empty">No moves yet</div>';
        return;
    }

    let html = '';
    for (let i = 0; i < moveHistory.length; i++) {
        const move = moveHistory[i];
        const moveNum = Math.floor(i / 2) + 1;
        const isWhiteMove = i % 2 === 0;

        if (isWhiteMove) {
            html += `<span class="move-item move-number">${moveNum}.</span> `;
        }

        const moveClass = i === currentNavPosition - 1 ? 'current' : 'nav-current';
        const isCurrent = i === moveHistory.length - 1 && gameActive;

        html += `<span class="move-item ${isCurrent ? 'current' : ''}" data-move-index="${i}">${move.san}</span> `;

        if (!isWhiteMove) {
            html += '<br>';
        }
    }

    movesList.innerHTML = html;

    // Add click listeners to moves
    movesList.querySelectorAll('.move-item[data-move-index]').forEach(el => {
        el.addEventListener('click', () => {
            navigateToMove(parseInt(el.dataset.moveIndex) + 1);
        });
    });
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
    currentNavPosition = moveHistory.length;
    updateRatingDisplay(change);
    updateBoard();
    updateMovesList();
    updateNavigationButtons();
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

function makeMove(from, to) {
    const move = chess.move({ from, to, promotion: 'q' });
    if (move) {
        moveHistory.push(move);
        moveCount++;
        currentNavPosition = moveHistory.length;
        updateBoard();
        updateMovesList();
        updateNavigationButtons();

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
                currentNavPosition = moveHistory.length;
                updateBoard();
                updateMovesList();
                updateNavigationButtons();
            }
        }
    } catch (e) {
        console.error('AI move failed:', e);
    }
}

function navigateToMove(moveIndex) {
    // Replay from initial endgame position to this move
    const tempChess = new Chess(initialFEN);

    for (let i = 0; i < moveIndex && i < moveHistory.length; i++) {
        tempChess.move(moveHistory[i]);
    }

    // Update the global chess instance to match
    chess.load(tempChess.fen());
    currentNavPosition = moveIndex;
    updateNavigationButtons();
    updateBoard();
    updateMovesList();
}

function updateNavigationButtons() {
    const hasMovesTotal = moveHistory.length > 0;
    const atBeginning = currentNavPosition === 0;
    const atEnd = currentNavPosition === moveHistory.length;

    firstMoveBtn.disabled = atBeginning;
    prevMoveBtn.disabled = atBeginning;
    nextMoveBtn.disabled = atEnd;
    lastMoveBtn.disabled = atEnd;
}

function resetGame() {
    chess.reset();
    moveHistory = [];
    moveCount = 0;
    currentNavPosition = 0;
    gameActive = false;
    ground.set({ fen: chess.fen() });
    updateBoard();
    updateMovesList();
    updateNavigationButtons();
}

function undoLastMove() {
    if (moveHistory.length > 0) {
        moveHistory.pop();
        chess.undo();
        moveCount--;
        currentNavPosition = moveHistory.length;
        updateBoard();
        updateMovesList();
        updateNavigationButtons();

        if (moveHistory.length > 0 && chess.turn() === 'w') {
            moveHistory.pop();
            chess.undo();
            moveCount--;
            currentNavPosition = moveHistory.length;
            updateBoard();
            updateMovesList();
            updateNavigationButtons();
        }
    }
}

function resign() {
    if (!gameActive) return;
    const winner = playerColor === 'white' ? 'Black' : 'White';
    endGame('loss');
    resultBox.style.display = 'block';
    resultBox.textContent = `${winner} wins! (You resigned)`;
    statusEl.textContent = `${winner} wins! (You resigned)`;
}



function showDashboard() {
    endgameDashboard.style.display = 'block';
    gamePanel.style.display = 'none';
    resetGame();
}

async function loadLichessPuzzle() {
    try {
        const url = `${API_BASE}/api/lichess-endgame?rating=${playerRating}`;
        const res = await fetch(url);
        
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();

        chess.load(data.fen);
        initialFEN = data.fen; // Save initial FEN for navigation
        playerColor = data.playerColor;
        currentEndgameType = data.name || data.type || 'Lichess Puzzle';

        moveHistory = [];
        moveCount = 0;
        currentNavPosition = 0;
        gameActive = true;
        resultBox.style.display = 'none';

        ground.set({ orientation: playerColor });
        updateBoard();
        updateMovesList();
        updateNavigationButtons();

        endgameDashboard.style.display = 'none';
        gamePanel.style.display = 'flex';

        playerIndicator.textContent = `You (${playerColor === 'white' ? 'White' : 'Black'})`;

        if (playerColor === 'black' && gameActive) {
            setTimeout(playAI, 500);
        }
    } catch (e) {
        console.error('Failed to load Lichess puzzle:', e);
        alert('Impossible de charger le puzzle. Vérifiez votre connexion internet et essayez à nouveau.');
    }
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

// Event listeners - Navigation
firstMoveBtn.addEventListener('click', () => {
    navigateToMove(0);
});

prevMoveBtn.addEventListener('click', () => {
    if (currentNavPosition > 0) {
        navigateToMove(currentNavPosition - 1);
    }
});

nextMoveBtn.addEventListener('click', () => {
    if (currentNavPosition < moveHistory.length) {
        navigateToMove(currentNavPosition + 1);
    }
});

lastMoveBtn.addEventListener('click', () => {
    navigateToMove(moveHistory.length);
});

// Event listeners - Start Game
startGameBtn.addEventListener('click', () => {
    loadLichessPuzzle();
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
updateMovesList();
updateNavigationButtons();
