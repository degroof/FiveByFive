// Game state
let gameData = [];
let gameNumber = 0;
let gameStatus = 'new'; // 'new', 'in progress', 'win', 'resign'
let boardState = {}; // Maps grid square number to tile letter
let startTime = null;
let timerInterval = null;
let draggedTile = null;
let peekActive = false;
let peekBackupState = {};
let tilePositions = {}; // Track original rack positions

// Black squares on the grid (those that cannot have tiles)
const BLACK_SQUARES = [6, 8, 16, 18];

// Valid target rows and columns
const VALID_ROWS = [0, 2, 4];
const VALID_COLS = [0, 2, 4];

// Row configurations (which squares make up each row)
const ROWS = {
    0: [0, 1, 2, 3, 4],
    2: [10, 11, 12, 13, 14],
    4: [20, 21, 22, 23, 24]
};

// Column configurations (which squares make up each column)
const COLS = {
    0: [0, 5, 10, 15, 20],
    2: [2, 7, 12, 17, 22],
    4: [4, 9, 14, 19, 24]
};

// DOM Elements
const gameGrid = document.getElementById('gameGrid');
const tileRack = document.getElementById('tileRack');
const gameNumberEl = document.getElementById('gameNumber');
const giveUpBtn = document.getElementById('giveUpBtn');
const peekBtn = document.getElementById('peekBtn');
const shareBtn = document.getElementById('shareBtn');
const instructionsToggle = document.getElementById('instructionsToggle');
const instructionsContent = document.getElementById('instructionsContent');

// Initialize game on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeGame();
    setupEventListeners();
});

/**
 * Calculate game number based on days since May 16, 2026
 */
function calculateGameNumber() {
    const baseDate = new Date('2026-05-16').getTime();
    const today = new Date().getTime();
    const daysDiff = Math.floor((today - baseDate) / (1000 * 60 * 60 * 24));
    return Math.max(1, daysDiff);
}

/**
 * Initialize the game
 */
function initializeGame() {
    gameNumber = calculateGameNumber();
    
    // Try to load saved game state
    const savedState = loadGameState();
    
    if (savedState && savedState.gameNumber === gameNumber) {
        // Restore saved game
        gameStatus = savedState.gameStatus;
        boardState = savedState.boardState;
        startTime = savedState.startTime;
        gameData = grids[gameNumber - 1] || grids[0];
    } else {
        // New game
        gameStatus = 'new';
        boardState = {};
        startTime = null;
        gameData = grids[gameNumber - 1] || grids[0];
    }
    
    gameNumberEl.textContent = `Game #${gameNumber}`;
    
    // Render UI
    renderGrid();
    renderTileRack();
    updateButtonVisibility();
    
    // If saved game, restore board state
    if (savedState && savedState.gameNumber === gameNumber) {
        restoreBoardState();
        checkBoard();
    }
}

/**
 * Render the 5x5 grid
 */
function renderGrid() {
    gameGrid.innerHTML = '';
    
    for (let i = 0; i < 25; i++) {
        const square = document.createElement('div');
        square.className = 'grid-square';
        square.id = `square-${i}`;
        
        if (BLACK_SQUARES.includes(i)) {
            square.classList.add('black');
        } else {
            square.classList.add('white');
            square.draggable = true;
            square.addEventListener('dragover', handleDragOver);
            square.addEventListener('drop', handleDrop);
            square.addEventListener('dragleave', handleDragLeave);
        }
        
        gameGrid.appendChild(square);
    }
}

/**
 * Render the tile rack below the grid
 */
function renderTileRack() {
    tileRack.innerHTML = '';
    const tileLetters = gameData[6];
    
    // Create 4 rows of 5 tiles + 1 centered tile
    for (let i = 0; i < 21; i++) {
        const slot = document.createElement('div');
        slot.className = 'tile-rack-slot';
        slot.id = `rack-slot-${i}`;
        
        // Add centered class to the 21st tile
        if (i === 20) {
            slot.classList.add('centered');
        }
        
        tileRack.appendChild(slot);
        
        const tile = document.createElement('div');
        tile.className = 'tile black-on-white';
        tile.textContent = tileLetters[i];
        tile.id = `tile-${i}`;
        tile.draggable = true;
        tile.dataset.tileIndex = i;
        tile.addEventListener('dragstart', handleDragStart);
        tile.addEventListener('dragend', handleDragEnd);
        
        slot.appendChild(tile);
        tilePositions[i] = slot;
    }
}

/**
 * Get current row word
 */
function getRowWord(rowNumber) {
    if (![0, 2, 4].includes(rowNumber)) {
        return '';
    }
    
    const squares = ROWS[rowNumber];
    let word = '';
    
    for (let square of squares) {
        if (!boardState[square]) {
            return ''; // Not all squares populated
        }
        word += boardState[square];
    }
    
    return word;
}

/**
 * Get current column word
 */
function getColWord(colNumber) {
    if (![0, 2, 4].includes(colNumber)) {
        return '';
    }
    
    const squares = COLS[colNumber];
    let word = '';
    
    for (let square of squares) {
        if (!boardState[square]) {
            return ''; // Not all squares populated
        }
        word += boardState[square];
    }
    
    return word;
}

/**
 * Set tile color on a grid square
 */
function setTileColor(squareNumber, color) {
    const square = document.getElementById(`square-${squareNumber}`);
    if (!square) return;
    
    const tile = square.querySelector('.tile');
    if (!tile) return;
    
    // Remove all color classes
    tile.classList.remove('black-on-white', 'white-on-red', 'white-on-green');
    
    // Add appropriate class
    if (color === 'white') {
        tile.classList.add('black-on-white');
    } else if (color === 'red') {
        tile.classList.add('white-on-red');
    } else if (color === 'green') {
        tile.classList.add('white-on-green');
    }
}

/**
 * Call checkBoard() - validates current board state
 */
function checkBoard() {
    // This function can be extended to validate words against a dictionary
    // For now, it's a placeholder that could check if all words are valid
    
    // Save game state
    saveGameState();
    
    // Update button visibility
    updateButtonVisibility();
}

/**
 * Win the game
 */
function win() {
    gameStatus = 'win';
    
    // Turn all tiles on the board to white text on green
    for (let squareNumber = 0; squareNumber < 25; squareNumber++) {
        if (boardState[squareNumber]) {
            setTileColor(squareNumber, 'green');
        }
    }
    
    saveGameState();
    updateButtonVisibility();
}

/**
 * Handle drag start
 */
function handleDragStart(e) {
    // Only allow dragging if game status is 'new' or 'in progress'
    if (!['new', 'in progress'].includes(gameStatus)) {
        e.preventDefault();
        return;
    }
    
    // Start timer if not already started
    if (gameStatus === 'new') {
        gameStatus = 'in progress';
        startTimer();
        updateButtonVisibility();
    }
    
    draggedTile = e.target;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.innerHTML);
    
    // Visual feedback
    e.target.style.opacity = '0.5';
}

/**
 * Handle drag end
 */
function handleDragEnd(e) {
    if (draggedTile) {
        draggedTile.style.opacity = '1';
    }
    draggedTile = null;
}

/**
 * Handle drag over
 */
function handleDragOver(e) {
    if (!draggedTile) return;
    
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Highlight valid target
    const squareNum = parseInt(e.target.id.split('-')[1]);
    if (!BLACK_SQUARES.includes(squareNum)) {
        e.target.classList.add('drag-over');
    }
}

/**
 * Handle drag leave
 */
function handleDragLeave(e) {
    e.target.classList.remove('drag-over');
}

/**
 * Handle drop
 */
function handleDrop(e) {
    e.preventDefault();
    e.target.classList.remove('drag-over');
    
    if (!draggedTile) return;
    
    // Only allow dropping if game is 'new' or 'in progress'
    if (!['new', 'in progress'].includes(gameStatus)) {
        return;
    }
    
    const squareNumber = parseInt(e.target.id.split('-')[1]);
    
    // Check if it's a valid drop target
    if (BLACK_SQUARES.includes(squareNumber)) {
        // Black square - return to original location
        returnTileToRack(draggedTile);
        checkBoard();
        return;
    }
    
    // Check if square already has a tile
    const existingTile = e.target.querySelector('.tile');
    if (existingTile && existingTile !== draggedTile) {
        // Another tile is already there - return to original location
        returnTileToRack(draggedTile);
        checkBoard();
        return;
    }
    
    // Valid drop - place tile on grid
    const tileIndex = parseInt(draggedTile.dataset.tileIndex);
    const letter = gameData[6][tileIndex];
    
    // Remove from previous location in boardState
    for (let sq in boardState) {
        const tile = document.getElementById(`square-${sq}`).querySelector(`#tile-${tileIndex}`);
        if (tile) {
            delete boardState[sq];
        }
    }
    
    // Add to new location
    boardState[squareNumber] = letter;
    
    // Move tile to grid square
    e.target.appendChild(draggedTile);
    draggedTile.style.position = 'absolute';
    draggedTile.style.top = '0';
    draggedTile.style.left = '0';
    
    checkBoard();
}

/**
 * Return tile to original rack position
 */
function returnTileToRack(tile) {
    const tileIndex = parseInt(tile.dataset.tileIndex);
    const rackSlot = tilePositions[tileIndex];
    
    if (rackSlot) {
        // Remove from grid board state
        for (let square in boardState) {
            const squareEl = document.getElementById(`square-${square}`);
            if (squareEl && squareEl.querySelector(`#tile-${tileIndex}`)) {
                delete boardState[square];
                break;
            }
        }
        
        // Reset tile colors
        tile.classList.remove('white-on-red', 'white-on-green');
        tile.classList.add('black-on-white');
        
        // Move back to rack
        rackSlot.appendChild(tile);
        tile.style.position = 'relative';
    }
}

/**
 * Restore board state from saved state
 */
function restoreBoardState() {
    for (let squareNumber in boardState) {
        const letter = boardState[squareNumber];
        const square = document.getElementById(`square-${squareNumber}`);
        
        if (square) {
            // Find the tile with this letter and move it to the square
            const tileIndex = gameData[6].indexOf(letter);
            if (tileIndex !== -1) {
                const tile = document.getElementById(`tile-${tileIndex}`);
                if (tile) {
                    square.appendChild(tile);
                    tile.style.position = 'absolute';
                    tile.style.top = '0';
                    tile.style.left = '0';
                }
            }
        }
    }
}

/**
 * Start the timer
 */
function startTimer() {
    startTime = Date.now();
    
    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        // Timer can be displayed if needed
    }, 1000);
}

/**
 * Save game state to local storage
 */
function saveGameState() {
    const state = {
        gameNumber: gameNumber,
        gameStatus: gameStatus,
        boardState: boardState,
        startTime: startTime
    };
    
    localStorage.setItem('5x5_gameState', JSON.stringify(state));
}

/**
 * Load game state from local storage
 */
function loadGameState() {
    const saved = localStorage.getItem('5x5_gameState');
    return saved ? JSON.parse(saved) : null;
}

/**
 * Update button visibility based on game status
 */
function updateButtonVisibility() {
    giveUpBtn.style.display = gameStatus === 'in progress' ? 'block' : 'none';
    peekBtn.style.display = ['win', 'resign'].includes(gameStatus) ? 'block' : 'none';
    shareBtn.style.display = gameStatus === 'win' ? 'block' : 'none';
}

/**
 * Handle PEEK button - show solution temporarily
 */
function handlePeekMouseDown() {
    if (!['win', 'resign'].includes(gameStatus)) return;
    
    peekActive = true;
    
    // Backup current board state
    peekBackupState = JSON.parse(JSON.stringify(boardState));
    
    // Clear board
    boardState = {};
    for (let i = 0; i < 25; i++) {
        const square = document.getElementById(`square-${i}`);
        if (square) {
            const tile = square.querySelector('.tile');
            if (tile) {
                const tileIndex = parseInt(tile.dataset.tileIndex);
                const slot = tilePositions[tileIndex];
                if (slot) {
                    slot.appendChild(tile);
                    tile.style.position = 'relative';
                }
            }
        }
    }
    
    // Place the solution
    placeWords(true);
}

/**
 * Handle PEEK button release - restore previous state
 */
function handlePeekMouseUp() {
    if (!peekActive) return;
    
    peekActive = false;
    
    // Clear board
    boardState = {};
    for (let i = 0; i < 25; i++) {
        const square = document.getElementById(`square-${i}`);
        if (square) {
            const tile = square.querySelector('.tile');
            if (tile) {
                const tileIndex = parseInt(tile.dataset.tileIndex);
                const slot = tilePositions[tileIndex];
                if (slot) {
                    slot.appendChild(tile);
                    tile.style.position = 'relative';
                }
            }
        }
    }
    
    // Restore backed up state
    boardState = peekBackupState;
    restoreBoardState();
}

/**
 * Place words on the board (for PEEK function)
 */
function placeWords(isPeek) {
    const words = gameData.slice(0, 6); // First 6 entries are the words
    
    // Place row words
    const rowWords = {
        0: words[0],
        2: words[1],
        4: words[2]
    };
    
    // Place column words
    const colWords = {
        0: words[3],
        2: words[4],
        4: words[5]
    };
    
    // Place row words
    for (let rowNum in rowWords) {
        const word = rowWords[rowNum];
        const squares = ROWS[rowNum];
        
        for (let i = 0; i < word.length; i++) {
            const squareNum = squares[i];
            const letter = word[i];
            
            // Find tile with this letter
            const tileIndex = gameData[6].indexOf(letter);
            if (tileIndex !== -1) {
                const tile = document.getElementById(`tile-${tileIndex}`);
                if (tile) {
                    const square = document.getElementById(`square-${squareNum}`);
                    if (square) {
                        square.appendChild(tile);
                        tile.style.position = 'absolute';
                        tile.style.top = '0';
                        tile.style.left = '0';
                        boardState[squareNum] = letter;
                    }
                }
            }
        }
    }
}

/**
 * Handle GIVE UP button
 */
function handleGiveUp() {
    gameStatus = 'resign';
    saveGameState();
    updateButtonVisibility();
    
    if (timerInterval) {
        clearInterval(timerInterval);
    }
}

/**
 * Handle SHARE button
 */
function handleShare() {
    if (gameStatus !== 'win') return;
    
    const row0 = getRowWord(0);
    const row2 = getRowWord(2);
    const row4 = getRowWord(4);
    const col0 = getColWord(0);
    const col2 = getColWord(2);
    const col4 = getColWord(4);
    
    const shareText = `5x5 Puzzle - Game #${gameNumber}\n\nRows: ${row0}, ${row2}, ${row4}\nColumns: ${col0}, ${col2}, ${col4}`;
    
    navigator.clipboard.writeText(shareText).then(() => {
        alert('Results copied to clipboard!');
    });
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    instructionsToggle.addEventListener('click', () => {
        if (instructionsContent.style.display === 'none') {
            instructionsContent.style.display = 'block';
        } else {
            instructionsContent.style.display = 'none';
        }
    });
    
    giveUpBtn.addEventListener('click', handleGiveUp);
    
    peekBtn.addEventListener('mousedown', handlePeekMouseDown);
    peekBtn.addEventListener('mouseup', handlePeekMouseUp);
    peekBtn.addEventListener('touchstart', handlePeekMouseDown);
    peekBtn.addEventListener('touchend', handlePeekMouseUp);
    
    shareBtn.addEventListener('click', handleShare);
}
