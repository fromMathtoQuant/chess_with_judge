// ===============================
// PARTE 1/3 — Setup e funzioni base
// ===============================

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

function fixCanvasResolution() {
    const ratio = window.devicePixelRatio || 1;

    const rect = canvas.getBoundingClientRect();

    // reset trasformazioni
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // imposta dimensioni interne coerenti con quelle CSS
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;

    // scala il contesto
    ctx.scale(ratio, ratio);    
}

const boardSize = 8;

function updateSquareSize() {
    const rect = canvas.getBoundingClientRect();
    size = rect.width / boardSize;
}

let size = 0;

// Stato iniziale della scacchiera
let board = [
    ["r","n","b","q","k","b","n","r"],
    ["p","p","p","p","p","p","p","p"],
    ["","","","","","","",""],
    ["","","","","","","",""],
    ["","","","","","","",""],
    ["","","","","","","",""],
    ["P","P","P","P","P","P","P","P"],
    ["R","N","B","Q","K","B","N","R"]
];

let turn = "w"; 
let selected = null;
let legalMoves = [];
let dragging = false;
let dragPiece = null;
let dragX = 0;
let dragY = 0;

// Arrocco
let castlingRights = {
    wK: true,
    wQ: true,
    bK: true,
    bQ: true
};

// En passant
let enPassantTarget = null;

// Immagini pezzi
const pieces = {
    "r": "pieces/bR.png",
    "n": "pieces/bN.png",
    "b": "pieces/bB.png",
    "q": "pieces/bQ.png",
    "k": "pieces/bK.png",
    "p": "pieces/bP.png",
    "R": "pieces/wR.png",
    "N": "pieces/wN.png",
    "B": "pieces/wB.png",
    "Q": "pieces/wQ.png",
    "K": "pieces/wK.png",
    "P": "pieces/wP.png"
};

// Cache immagini
const imageCache = {};
for (let key in pieces) {
    const img = new Image();
    img.src = pieces[key];
    img.decoding = "async";
    img.loading = "eager";
    imageCache[key] = img;
}

// Utility
function isWhite(p) { return p === p.toUpperCase(); }
function isEnemy(p1, p2) { return p1 && p2 && isWhite(p1) !== isWhite(p2); }
function inBounds(x, y) { return x >= 0 && x < 8 && y >= 0 && y < 8; }
function cloneBoard(b) { return b.map(r => r.slice()); }

// Trova il re
function findKing(b, white) {
    const target = white ? "K" : "k";
    for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++)
            if (b[y][x] === target) return { x, y };
    return null;
}

// Controlla se una casa è attaccata
function squareAttacked(b, x, y, byWhite, enPassant, castling) {
    for (let yy = 0; yy < 8; yy++) {
        for (let xx = 0; xx < 8; xx++) {
            const p = b[yy][xx];
            if (!p) continue;
            if (isWhite(p) !== byWhite) continue;

            if (basicLegalMove(b, p, xx, yy, x, y, byWhite ? "w" : "b", enPassant, castling, true)) {
                return true;
            }
        }
    }
    return false;
}

// Movimento base (senza controllo scacco)
function basicLegalMove(b, piece, x1, y1, x2, y2, turnColor, enPassant, castling, ignoreKingSpecial) {
    if (!inBounds(x2, y2)) return false;
    if (x1 === x2 && y1 === y2) return false;

    const target = b[y2][x2];
    const white = isWhite(piece);
    if (target && isWhite(target) === white) return false;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    switch (piece.toLowerCase()) {
        case "p": {
            const dir = white ? -1 : 1;
            const startRank = white ? 6 : 1;

            if (dx === 0 && dy === dir && !target) return true;

            if (dx === 0 && dy === 2 * dir && y1 === startRank && !target) {
                if (!b[y1 + dir][x1]) return true;
            }

            if (absDx === 1 && dy === dir && target && isEnemy(piece, target)) return true;

            if (absDx === 1 && dy === dir && !target && enPassant) {
                if (enPassant.x === x2 && enPassant.y === y2) return true;
            }

            return false;
        }

        case "n":
            return (absDx === 1 && absDy === 2) || (absDx === 2 && absDy === 1);

        case "b":
            if (absDx !== absDy) return false;
            return pathClear(b, x1, y1, x2, y2);

        case "r":
            if (dx !== 0 && dy !== 0) return false;
            return pathClear(b, x1, y1, x2, y2);

        case "q":
            if (dx === 0 || dy === 0 || absDx === absDy)
                return pathClear(b, x1, y1, x2, y2);
            return false;

        case "k":
            if (absDx <= 1 && absDy <= 1) return true;

            if (ignoreKingSpecial) return false;

            const rank = white ? 7 : 0;

            if (y1 === rank && x1 === 4 && y2 === rank) {
                if (x2 === 6) {
                    const key = white ? "wK" : "bK";
                    if (!castling[key]) return false;
                    if (b[rank][5] || b[rank][6]) return false;
                    if (squareAttacked(b, 4, rank, !white, enPassant, castling)) return false;
                    if (squareAttacked(b, 5, rank, !white, enPassant, castling)) return false;
                    if (squareAttacked(b, 6, rank, !white, enPassant, castling)) return false;
                    return true;
                }
                if (x2 === 2) {
                    const key = white ? "wQ" : "bQ";
                    if (!castling[key]) return false;
                    if (b[rank][1] || b[rank][2] || b[rank][3]) return false;
                    if (squareAttacked(b, 4, rank, !white, enPassant, castling)) return false;
                    if (squareAttacked(b, 3, rank, !white, enPassant, castling)) return false;
                    if (squareAttacked(b, 2, rank, !white, enPassant, castling)) return false;
                    return true;
                }
            }

            return false;
    }

    return false;
}

function pathClear(b, x1, y1, x2, y2) {
    let dx = Math.sign(x2 - x1);
    let dy = Math.sign(y2 - y1);
    let x = x1 + dx;
    let y = y1 + dy;

    while (x !== x2 || y !== y2) {
        if (b[y][x]) return false;
        x += dx;
        y += dy;
    }
    return true;
}

// Controlla se il re è in scacco
function inCheck(b, color, enPassant, castling) {
    const white = color === "w";
    const k = findKing(b, white);
    if (!k) return false;
    return squareAttacked(b, k.x, k.y, !white, enPassant, castling);
}

function init() {
    fixCanvasResolution();
    updateSquareSize();
    drawBoard();
}

window.addEventListener("load", init);

window.addEventListener("resize", () => {
    fixCanvasResolution();
    updateSquareSize();
    drawBoard();
});


// ===============================
// PARTE 2/3 — Logica completa delle mosse
// ===============================

// Applica una mossa a una board clonata (per simulazioni)
function makeMove(b, x1, y1, x2, y2, turnColor, enPassant, castling) {
    const newBoard = cloneBoard(b);
    const piece = newBoard[y1][x1];
    const white = isWhite(piece);

    let newEnPassant = null;
    let newCastling = { ...castling };

    // EN PASSANT
    if (piece.toLowerCase() === "p" && enPassant && x2 === enPassant.x && y2 === enPassant.y) {
        const dir = white ? 1 : -1;
        newBoard[y2 + dir][x2] = "";
    }

    // Sposta pezzo
    newBoard[y1][x1] = "";
    newBoard[y2][x2] = piece;

    // PROMOZIONE AUTOMATICA A DONNA
    if (piece.toLowerCase() === "p") {
        if (white && y2 === 0) newBoard[y2][x2] = "Q";
        if (!white && y2 === 7) newBoard[y2][x2] = "q";

        const startRank = white ? 6 : 1;
        const dir = white ? -1 : 1;

        if (y1 === startRank && y2 === y1 + 2 * dir) {
            newEnPassant = { x: x1, y: y1 + dir };
        }
    }

    // ARROCCO
    if (piece === "K") {
        newCastling.wK = false;
        newCastling.wQ = false;

        if (x1 === 4 && y1 === 7 && x2 === 6) {
            newBoard[7][5] = newBoard[7][7];
            newBoard[7][7] = "";
        }
        if (x1 === 4 && y1 === 7 && x2 === 2) {
            newBoard[7][3] = newBoard[7][0];
            newBoard[7][0] = "";
        }
    }

    if (piece === "k") {
        newCastling.bK = false;
        newCastling.bQ = false;

        if (x1 === 4 && y1 === 0 && x2 === 6) {
            newBoard[0][5] = newBoard[0][7];
            newBoard[0][7] = "";
        }
        if (x1 === 4 && y1 === 0 && x2 === 2) {
            newBoard[0][3] = newBoard[0][0];
            newBoard[0][0] = "";
        }
    }

    // Torri che si muovono
    if (piece === "R") {
        if (x1 === 0 && y1 === 7) newCastling.wQ = false;
        if (x1 === 7 && y1 === 7) newCastling.wK = false;
    }
    if (piece === "r") {
        if (x1 === 0 && y1 === 0) newCastling.bQ = false;
        if (x1 === 7 && y1 === 0) newCastling.bK = false;
    }

    // Torri catturate
    const captured = b[y2][x2];
    if (captured === "R") {
        if (x2 === 0 && y2 === 7) newCastling.wQ = false;
        if (x2 === 7 && y2 === 7) newCastling.wK = false;
    }
    if (captured === "r") {
        if (x2 === 0 && y2 === 0) newCastling.bQ = false;
        if (x2 === 7 && y2 === 0) newCastling.bK = false;
    }

    return { board: newBoard, enPassant: newEnPassant, castling: newCastling };
}

// Controllo mossa legale completa
function isLegalMove(piece, x1, y1, x2, y2) {
    if (!piece) return false;

    const color = isWhite(piece) ? "w" : "b";
    if (color !== turn) return false;

    if (!basicLegalMove(board, piece, x1, y1, x2, y2, color, enPassantTarget, castlingRights, false)) {
        return false;
    }

    const { board: newBoard, enPassant: newEP, castling: newCastling } =
        makeMove(board, x1, y1, x2, y2, color, enPassantTarget, castlingRights);

    if (inCheck(newBoard, color, newEP, newCastling)) {
        return false;
    }

    return true;
}

// Tutte le mosse legali da una casella
function getLegalMoves(x1, y1) {
    const piece = board[y1][x1];
    if (!piece) return [];

    const color = isWhite(piece) ? "w" : "b";
    if (color !== turn) return [];

    const moves = [];

    for (let y2 = 0; y2 < 8; y2++) {
        for (let x2 = 0; x2 < 8; x2++) {
            if (isLegalMove(piece, x1, y1, x2, y2)) {
                moves.push({ x: x2, y: y2 });
            }
        }
    }

    return moves;
}

// Applica la mossa reale
function applyMove(x1, y1, x2, y2) {
    const piece = board[y1][x1];
    const color = isWhite(piece) ? "w" : "b";

    const result = makeMove(board, x1, y1, x2, y2, color, enPassantTarget, castlingRights);

    board = result.board;
    enPassantTarget = result.enPassant;
    castlingRights = result.castling;

    turn = turn === "w" ? "b" : "w";
    document.getElementById("turnIndicator").textContent =
    turn === "w" ? "Tocca al Bianco" : "Tocca al Nero";
}

function hasAnyLegalMove(color) {
    for (let y1 = 0; y1 < 8; y1++) {
        for (let x1 = 0; x1 < 8; x1++) {
            const piece = board[y1][x1];
            if (!piece) continue;
            if (isWhite(piece) !== (color === "w")) continue;

            const moves = getLegalMoves(x1, y1);
            if (moves.length > 0) return true;
        }
    }
    return false;
}

// ===============================
// PARTE 3/3 — Disegno + Input iPhone ottimizzato
// ===============================

// Disegna la scacchiera
function drawBoard() {
    const whiteInCheck = inCheck(board, "w", enPassantTarget, castlingRights);
    const blackInCheck = inCheck(board, "b", enPassantTarget, castlingRights);

    // Sfondo caselle
    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            ctx.fillStyle = (x + y) % 2 === 0 ? "#f0d9b5" : "#b58863";
            ctx.fillRect(x * size, y * size, size, size);
        }
    }

    // Casella selezionata
    if (selected) {
        ctx.fillStyle = "rgba(255,255,0,0.5)";
        ctx.fillRect(selected.x * size, selected.y * size, size, size);
    }

    // Mosse legali
    for (let m of legalMoves) {
        ctx.fillStyle = board[m.y][m.x] ? "rgba(255,0,0,0.4)" : "rgba(0,255,0,0.4)";
        ctx.fillRect(m.x * size, m.y * size, size, size);
    }

    // Re in scacco
    if (whiteInCheck) {
        const k = findKing(board, true);
        ctx.fillStyle = "rgba(255,0,0,0.5)";
        ctx.fillRect(k.x * size, k.y * size, size, size);
    }
    if (blackInCheck) {
        const k = findKing(board, false);
        ctx.fillStyle = "rgba(255,0,0,0.5)";
        ctx.fillRect(k.x * size, k.y * size, size, size);
    }

    // Disegna pezzi (tranne quello trascinato)
    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            const piece = board[y][x];
            if (!piece) continue;

            if (dragging && dragPiece === piece && selected &&
                selected.x === x && selected.y === y) continue;

            const img = imageCache[piece];
            if (img.complete) {
                ctx.drawImage(img, x * size, y * size, size, size);
            }
        }
    }

    // Disegna pezzo trascinato
    if (dragging && dragPiece) {
        const img = imageCache[dragPiece];
        if (img.complete) {
            ctx.drawImage(img, dragX - size / 2, dragY - size / 2, size, size);
        }
    }
}

// ===============================
// INPUT — MOUSE
// ===============================

canvas.addEventListener("mousedown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / size);
    const y = Math.floor((e.clientY - rect.top) / size);

    if (!inBounds(x, y)) return;

    const piece = board[y][x];

    if (!piece || isWhite(piece) !== (turn === "w")) {
        if (selected) tryMove(selected.x, selected.y, x, y);
        return;
    }

    selected = { x, y };
    legalMoves = getLegalMoves(x, y);

    dragging = true;
    dragPiece = piece;
    dragX = e.clientX - rect.left;
    dragY = e.clientY - rect.top;

    drawBoard();
});

canvas.addEventListener("mousemove", (e) => {
    if (!dragging) return;

    const rect = canvas.getBoundingClientRect();
    dragX = e.clientX - rect.left;
    dragY = e.clientY - rect.top;

    drawBoard();
});

canvas.addEventListener("mouseup", (e) => {
    if (!dragging || !selected) return;

    const rect = canvas.getBoundingClientRect();
    const x2 = Math.round((e.clientX - rect.left) / size);
    const y2 = Math.round((e.clientY - rect.top) / size);

    tryMove(selected.x, selected.y, x2, y2);
});

// ===============================
// INPUT — TOUCH (iPhone ottimizzato)
// ===============================

let lastTap = 0;

function getSquareFromTouch(touch, rect) {
    const x = (touch.clientX - rect.left);
    const y = (touch.clientY - rect.top);

    // Tolleranza: espandi virtualmente la casella
    const tolerance = size * 0.25;

    const col = Math.floor((x + tolerance) / size);
    const row = Math.floor((y + tolerance) / size);

    return {
        x: Math.min(7, Math.max(0, col)),
        y: Math.min(7, Math.max(0, row))
    };
}

canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];

    const x = Math.floor((touch.clientX - rect.left) / size);
    const y = Math.floor((touch.clientY - rect.top) / size);

    if (!inBounds(x, y)) return;

    const piece = board[y][x];

    if (!piece || isWhite(piece) !== (turn === "w")) {
        if (selected) tryMove(selected.x, selected.y, x, y);
        return;
    }

    selected = { x, y };
    legalMoves = getLegalMoves(x, y);

    dragging = true;
    dragPiece = piece;

    dragX = touch.clientX - rect.left;
    dragY = touch.clientY - rect.top;

    drawBoard();
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (!dragging) return;

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];

    // smoothing movimento opzionale
    // dragX = dragX * 0.6 + (touch.clientX - rect.left) * 0.4;
    // dragY = dragY * 0.6 + (touch.clientY - rect.top) * 0.4;

    dragX = touch.clientX - rect.left;
    dragY = touch.clientY - rect.top;

    drawBoard();
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
    e.preventDefault();
    if (!dragging || !selected) return;

    const rect = canvas.getBoundingClientRect();
    const touch = e.changedTouches[0];

    // const { x: x2, y: y2 } = getSquareFromTouch(touch, rect);
    const x2 = Math.floor(dragX / size);
    const y2 = Math.floor(dragY / size);

    tryMove(selected.x, selected.y, x2, y2);
}, { passive: false });

// ===============================
// Esegui mossa
// ===============================

function tryMove(x1, y1, x2, y2) {
    dragging = false;
    dragPiece = null;

    if (inBounds(x2, y2) && isLegalMove(board[y1][x1], x1, y1, x2, y2)) {
        applyMove(x1, y1, x2, y2);

        const enemy = turn; // dopo il cambio turno
        
        if (inCheck(board, enemy, enPassantTarget, castlingRights)) {
            if (!hasAnyLegalMove(enemy)) {
                setTimeout(() => {
                    alert("SCACCO MATTERELLO!\nFine partita.\nVittoria " + (enemy === "w" ? "Nero" : "Bianco"));
                }, 100);
            }
        }
    }

    selected = null;
    legalMoves = [];
    drawBoard();
}

// Disegna inizialmente
drawBoard();

document.getElementById("newGameBtn").addEventListener("click", () => {
    board = [
        ["r","n","b","q","k","b","n","r"],
        ["p","p","p","p","p","p","p","p"],
        ["","","","","","","",""],
        ["","","","","","","",""],
        ["","","","","","","",""],
        ["","","","","","","",""],
        ["P","P","P","P","P","P","P","P"],
        ["R","N","B","Q","K","B","N","R"]
    ];

    turn = "w";
    enPassantTarget = null;
    castlingRights = { wK:true, wQ:true, bK:true, bQ:true };
    selected = null;
    legalMoves = [];

    document.getElementById("turnIndicator").textContent = "Tocca al Bianco";

    drawBoard();
});