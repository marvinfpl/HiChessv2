import {Chess, SQUARES} from 'https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm';
import { Chessground } from 'https://cdn.jsdelivr.net/npm/@lichess-org/chessground@10.1.0/+esm';

function buildLegalDestinations(chess) {
    const dests = new Map();
    const turn = chess.turn();
    for (const square of SQUARES) {
        const piece = chess.get(square);
        if (!piece || piece.color !== turn) {
            continue;
        }

        const ms = chess.moves({square, verbose: true});
        if (ms.length > 0) {
            dests.set(square, ms.map((m) => m.to),);
        }
    }
    return dests;
}

function findKingSquare(chess, color) {
    for (const square of SQUARES) {
        const piece = chess.get(square);
        if (piece && piece.type === 'k' && piece.color === color) {
            return square;
        }
    }
    return undefined;
}

function syncGroundFromChess(ground, chess) {
    const gameOver = chess.isGameOver();
    const turn = chess.turn();
    const color = turn === 'w' ? 'white': 'black';
    ground.set({
        fen: chess.fen(),
        turnColor: color,
        viewOnly: gameOver,
        check: chess.InCheck() ? findKingSquare(chess, turn) : undefined,
        movable: {
            free: false,
            color: gameOver ? undefined : color,
            dests: gameOver ? new Map() : buildLegalDestinations(chess),
            showDests: true,
        },
        draggable: {
            enabled: !gameOver,
        },
    });
}

export function mountRulesChessground(host) {
    const chess = new Chess();

    const groundRef = Chessground(
        host, 
        {
            fen: chess.fen(),
            orientation: 'white',
            coordinates: true,
            movable: {
                free: false,
                color: 'white',
                dests: buildLegalDestinations(chess),
                showDests: true,
            },
            draggable: {
                enabled: true,
                showGhost: true,
            },
            premovable: {
                enabled: false,
            },
            drawable: {
                enabled: true,
                visible: true,
            }
        }
    )

    syncGroundFromChess(groundRef, chess);
}