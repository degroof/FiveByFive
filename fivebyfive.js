let gameData = [];
let gameNumber = 0;
let gameStatus = 'new'; // 'new', 'in progress', 'win', 'resign'
let boardState = {};
let startTime = null;
let timerInterval = null;
let draggedTile = null;
let hints = 0;
let moves = 0;
let wordsFound = 0;
let elapsed = 0;
let checkActive = false;
let checkBackupState = {};
let hintActive = false;
let hintBackupState = {};
let tilePositions = {};
let squareColors = [];

const BLACK_SQUARES = [6, 8, 16, 18];

// Expected letter indices
const EXPECTED = [
    [0,0],[0,1],[0,2],[0,3],[0,4],
    [3,1],[-1,-1],[4,1],[-1,-1],[5,1],
    [1,0],[1,1],[1,2],[1,3],[1,4],
    [3,3],[-1,-1],[4,3],[-1,-1],[5,3],
    [2,0],[2,1],[2,2],[2,3],[2,4]
];


const WORD_SQUARES = [
    [0,1,2,3,4],
    [10,11,12,13,14],
    [20,21,22,23,24],
    [0,5,10,15,20],
    [2,7,12,17,22],
    [4,9,14,19,24]
    ];

// DOM Elements
const gameGrid = document.getElementById('gameGrid');
const tileRack = document.getElementById('tileRack');
const gameNumberEl = document.getElementById('gameNumber');
const giveUpBtn = document.getElementById('giveUpBtn');
const hintBtn = document.getElementById('hintBtn');
const checkBtn = document.getElementById('checkBtn');
const shareBtn = document.getElementById('shareBtn');
const instructionsToggle = document.getElementById('instructionsToggle');
const instructionsContent = document.getElementById('instructionsContent');

// Initialize game on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeGame();
    setupEventListeners();
});

// drag event listeners for game-board-container
const gameBoardContainer = document.querySelector('.game-board-container');
gameBoardContainer.addEventListener('dragover', handleDragOver);
gameBoardContainer.addEventListener('drop', handleDropOnContainer);
gameBoardContainer.addEventListener('dragleave', handleDragLeave);

/**
 * Calculate game number based on days since start
 */
function calculateGameNumber() {
    const baseDate = new Date('2026-05-18 00:00:00').getTime(); //must start at midnight
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

    //if it's a device that's played before and the player is returning, restore the game
    if (savedState && savedState.gameNumber === gameNumber) {
        gameStatus = savedState.gameStatus;
        boardState = savedState.boardState;
        startTime = savedState.startTime;
        gameData = grids[gameNumber - 1] || grids[0];
        hints = savedState.hints;
        moves = savedState.moves;
        wordsFound = savedState.wordsFound;
        elapsed = savedState.elapsed;
    } else {
        //start a new game
        gameStatus = 'new';
        boardState = {};
        startTime = null;
        gameData = grids[gameNumber - 1] || grids[0];
        hints = 0;
        moves = 0;
        wordsFound = 0;
        elapsed = 0;
    }
    
    gameNumberEl.textContent = `Game #${gameNumber}`;

    //set up grid, tile rack, and buttons
    renderGrid();
    renderTileRack();
    updateButtonVisibility();
    
    //if it's a device that's played before and the player is returning, restore the tile positions
    if (savedState && savedState.gameNumber === gameNumber) {
        restoreBoardState();
        checkBoard();
    }
}

/**
 * draw the 5x5 grid
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
            //square.draggable = true;
            square.addEventListener('dragover', handleDragOver);
            square.addEventListener('drop', handleDrop);
            square.addEventListener('dragleave', handleDragLeave);
        }
        
        gameGrid.appendChild(square);
    }
}

/**
 * draw the tile rack
 */
function renderTileRack() {
    tileRack.innerHTML = '';
    const tileLetters = gameData[6];
    
    // Create 3 rows of 7 tiles
    for (let i = 0; i < 21; i++) {
        const slot = document.createElement('div');
        slot.className = 'tile-rack-slot';
        slot.id = `rack-slot-${i}`;

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
 * Set tile color on a grid square
 */
function setTileColor(squareNumber, color) {
    const square = document.getElementById(`square-${squareNumber}`);
    if (!square) return; //no square
    
    const tile = square.querySelector('.tile');
    if (!tile) return; //no tile on square
    
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
* Get the color of the tile on a grid square
*/
function getTileColor(squareNumber)
{
    const square = document.getElementById(`square-${squareNumber}`);
    if (!square) return ''; //no square

    const tile = square.querySelector('.tile');
    if (!tile) return ''; //no tile on square

    if(tile.classList.contains('black-on-white')) return 'white';
    if(tile.classList.contains('white-on-red')) return 'red';
    if(tile.classList.contains('white-on-green')) return 'green';
}

/**
 * validates current board state, turns incorrect words red, then correct words green
 */
function checkBoard() {
    // Save game state
    saveGameState();
    let letters = gameData[6];
    let good=[];
    let bad=[];
    for(let wordInd of WORD_SQUARES)
    {
        let word="";
        for(let i=0;i<5;i++) //assemble the word
        {
            word+=letters[boardState[wordInd[i]]];
            setTileColor(wordInd[i],"white");
        }
        if(word.length==5) //if there's a complete word
        {
            if(WORDS.includes(word)) //if the word is in the dictionary
            {
                good.push(wordInd); //add to correct list
            }
            else
            {
                bad.push(wordInd); //add to incorrect list
            }
        }
    }
    wordsFound=0; //reset number of valid words
    for(let badInd of bad) //mark all incorrect words red
    {
        for(let i=0;i<5;i++)
        {
            setTileColor(badInd[i],"red");
        }
    }
    for(let goodInd of good) //mark all correct words green (overrides red t intersections)
    {
        wordsFound++;
        for(let i=0;i<5;i++)
        {
            setTileColor(goodInd[i],"green");
        }
    }
    if(wordsFound==6) win(); //if there's 6 correct words, player wins, end game
    saveGameState();
    updateButtonVisibility();
}

/**
 * player wins
 */
function win() {
    gameStatus = 'win';

    //stop timer
    if (timerInterval) {
        clearInterval(timerInterval);
    }

    saveGameState();
    updateButtonVisibility();
}

/**
 * drag start
 */
function handleDragStart(e) {
    //only allow dragging if the game is playable
    if (!['new', 'in progress'].includes(gameStatus)) {
        e.preventDefault();
        return;
    }
    
    //start timer if not already started
    if (gameStatus === 'new') {
        gameStatus = 'in progress';
        startTimer();
        updateButtonVisibility();
    }
    
    draggedTile = e.target;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.innerHTML);
}

/**
 * drag end
 */
function handleDragEnd(e) {
    draggedTile = null;
}

/**
 * drag over
 */
function handleDragOver(e) {
    if (!draggedTile) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (e.target.classList.contains('grid-square')) { //grid square
        const squareNum = parseInt(e.target.id.split('-')[1]);
        if (!BLACK_SQUARES.includes(squareNum)) {
            e.target.classList.add('drag-over');
        }
    } else if (e.target.closest('.game-board-container')) { //background
        e.target.classList.add('drag-over');
    }
}

/**
 * drag leave
 */
function handleDragLeave(e) {
    e.target.classList.remove('drag-over');
}

/**
 * drop
 */
function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.target.classList.remove('drag-over');
    
    if (!draggedTile) return;
    
    //only allow dropping if game is playable (this should never happen)
    if (!['new', 'in progress'].includes(gameStatus)) {
        return;
    }
    
    const squareNumber = parseInt(e.target.id.split('-')[1]);

    //can't drop on another tile; return to rack
    if(e.target.id.split('-')[0]==="tile") return;

    //can't drop on a black square; return to rack
    if (BLACK_SQUARES.includes(squareNumber)) {
        returnTileToRack(draggedTile);
        checkBoard();
        return;
    }
    
    //drop tile on grid
    const tileIndex = parseInt(draggedTile.dataset.tileIndex);
    const letter = gameData[6][tileIndex];

    //delete tile from old position in board state, if any
    for (let sq in boardState) {
        const tile = document.getElementById(`square-${sq}`).querySelector(`#tile-${tileIndex}`);
        if (tile) {
            delete boardState[sq];
        }
    }

    //add tile to new position in board state
    boardState[squareNumber] = tileIndex;

    //drop tile on grid square
    e.target.appendChild(draggedTile);
    draggedTile.style.position = 'absolute';
    draggedTile.style.top = '4';
    draggedTile.style.left = '4';

    //increment moves
    moves++;
    //check words
    checkBoard();
}

/**
 * drop on background (outside grid); return to rack
 */
function handleDropOnContainer(e) {
    e.preventDefault();
    e.target.classList.remove('drag-over');

    if (!draggedTile) return; //no tile?

    returnTileToRack(draggedTile);
    checkBoard();
}


/**
 *return tile to original rack position
 */
function returnTileToRack(tile) {
    const tileIndex = parseInt(tile.dataset.tileIndex);
    const rackSlot = tilePositions[tileIndex];
    
    if (rackSlot) {
        //delete from board state
        for (let square in boardState) {
            const squareEl = document.getElementById(`square-${square}`);
            if (squareEl && squareEl.querySelector(`#tile-${tileIndex}`)) {
                delete boardState[square];
                break;
            }
        }
        
        //clear any tile colors
        tile.classList.remove('white-on-red', 'white-on-green');
        tile.classList.add('black-on-white');
        
        //move back to rack
        rackSlot.appendChild(tile);
        tile.style.position = 'relative';
    }
}

/**
 *re-draw board from saved state
 */
function restoreBoardState() {
    for (let squareNumber in boardState) {
        const tileIndex = boardState[squareNumber];
        const square = document.getElementById(`square-${squareNumber}`);
        if (square) {
            if (tileIndex !== -1) {
                const tile = document.getElementById(`tile-${tileIndex}`);
                if (tile) {
                    square.appendChild(tile);
                    tile.style.position = 'absolute';
                    tile.style.top = '4';
                    tile.style.left = '4';
                }
            }
        }
    }
}

/**
 *get the timer running
 */
function startTimer() {
    startTime = Date.now();
    
    timerInterval = setInterval(() => {
        elapsed = Math.floor((Date.now() - startTime) / 1000);
    }, 1000);
}

/**
 *save game to local storage
 */
function saveGameState() {
    const state = {
        gameNumber: gameNumber,
        gameStatus: gameStatus,
        boardState: boardState,
        startTime: startTime,
        hints: hints,
        moves: moves,
        wordsFound: wordsFound,
        elapsed: elapsed
    };
    
    localStorage.setItem('5x5_gameState', JSON.stringify(state));
}

/**
 *load game from local storage
 */
function loadGameState() {
    const saved = localStorage.getItem('5x5_gameState');
    return saved ? JSON.parse(saved) : null;
}

/**
 *update button visibility based on game status
 */
function updateButtonVisibility() {
    giveUpBtn.style.display = gameStatus === 'in progress' ? 'block' : 'none';
    hintBtn.style.display = ['new', 'in progress'].includes(gameStatus) ? 'block' : 'none';
    checkBtn.style.display = ['win', 'resign'].includes(gameStatus) ? 'block' : 'none';
    shareBtn.style.display = ['win', 'resign'].includes(gameStatus) ? 'block' : 'none';
}

/**
 *clear board (all tiles back to original rack positions)
 */
function clearBoard()
{
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
}


/**
 * "check" button pressed - show expected solution
 */
function handleCheckMouseDown(e) {
    e.preventDefault();
    if (!['win', 'resign'].includes(gameStatus)) return;
    
    checkActive = true;
    squareColors = [];
    for(let i=0;i<25;i++)
    {
        squareColors.push(getTileColor(i));
        setTileColor(i,'white');
    }
    //backup current board state
    checkBackupState = JSON.parse(JSON.stringify(boardState));
    clearBoard();
    //show the solution
    showExpectedSolution();
}

/**
 *"check" button released - restore board state
 */
function handleCheckMouseUp(e) {
    e.preventDefault();
    if (!checkActive) return;
    checkActive = false;
    clearBoard();
    //restore backed up state
    boardState = checkBackupState;
    restoreBoardState();

    for(let i=0;i<25;i++)
    {
        if(squareColors[i]!='') setTileColor(i,squareColors[i]);
    }
}

/**
 * "hint" button pressed - show hints from expected solution
 */
function handleHintMouseDown(e) {
    e.preventDefault();
    if (!['new', 'in progress'].includes(gameStatus)) return;

    hintActive = true;
    squareColors = [];
    for(let i=0;i<25;i++)
    {
        squareColors.push(getTileColor(i));
        setTileColor(i,'white');
    }
    //backup current board state
    hintBackupState = JSON.parse(JSON.stringify(boardState));
    clearBoard();

    if(hints<3) hints++; //increment number of hints
    let usedTiles=[]; //list of tiles already placed
    let revealedSquares=[]; //list of squares to fill
    boardState = {}; //reset board state

    clearBoard();

    if(hints>=1) revealedSquares.push(12); //center square
    if(hints>=2)
    {
        revealedSquares.push(2); //middle square of each side
        revealedSquares.push(10);
        revealedSquares.push(14);
        revealedSquares.push(22);
    }
    if(hints>=3)
    {
        revealedSquares.push(0); //corner squares
        revealedSquares.push(4);
        revealedSquares.push(20);
        revealedSquares.push(24);
    }
    let letters = gameData[6]; //list of available letters
    let rowText = gameData[0]+"     "+gameData[1]+"     "+gameData[2];

    for(const square of revealedSquares)
    {
        let targetLetter = rowText[square];
        //get next available matching tile
        let index = letters.split('').findIndex((char, i) => char === targetLetter && !usedTiles.includes(i));
        usedTiles.push(index); //add to list of already used
        boardState[square]=index; //update board state
    }

    restoreBoardState();

}

/**
 *"hint" button released - restore board state
 */
function handleHintMouseUp(e) {
    e.preventDefault();
    if (!hintActive) return;
    hintActive = false;
    clearBoard();
    //restore backed up state
    boardState = hintBackupState;
    restoreBoardState();

    for(let i=0;i<25;i++)
    {
        if(squareColors[i]!='') setTileColor(i,squareColors[i]);
    }
}

/**
 *show expected solution
 */
function showExpectedSolution() {
    const words = gameData.slice(0, 6); // First 6 entries are the words
    
    let letters = gameData[6];
    let usedTiles=[]; //list of tiles already used to display the words
    // iterate through all 25 squares
    for (let i=0;i<25;i++) {
        let index=EXPECTED[i]; //get the word/letter combo for the square
        let wordInd=index[0]; //word number
        let letterInd=index[1]; //letter of word
        if(wordInd>=0) //if the number is -1, it's a black square
        {
            let word=gameData[wordInd]; //get the expected word
            let letter=word[letterInd]; //get the letter for that position
            //find the first matching available tile
            let tileIndex = letters.split('').findIndex((char, i) => char === letter && !usedTiles.includes(i));
            usedTiles.push(tileIndex); //add this tile to the used list
            const tile = document.getElementById(`tile-${tileIndex}`);
            if (tile) {
                const square = document.getElementById(`square-${i}`);
                if (square) { //position the tile on the grid
                    square.appendChild(tile);
                    tile.style.position = 'absolute';
                    tile.style.top = '4';
                    tile.style.left = '4';
                    boardState[i] = letter;
                }
            }
        }
        
    }
}

/**
 * "give up" clicked
 */
function handleGiveUp() {
    gameStatus = 'resign';
    saveGameState();
    updateButtonVisibility();
    
    if (timerInterval) { //stop timer
        clearInterval(timerInterval);
    }
}

/**
 * "hint" clicked
 */
function handleHint() {

    if(gameStatus=='new') //start game if not already started
     {
        gameStatus='in progress';
        startTimer();
     }

    for(let i=0;i<25;i++) //clear any tile colors
    {
        squareColors.push(getTileColor(i));
        setTileColor(i,'white');
    }

    hints++; //increment number of hints
    let usedTiles=[]; //list of tiles already placed
    let revealedSquares=[]; //list of squares to fill
    boardState = {}; //reset board state

    clearBoard();

    if(hints>=1) revealedSquares.push(12); //center square
    if(hints>=2)
    {
        revealedSquares.push(2); //middle square of each side
        revealedSquares.push(10);
        revealedSquares.push(14);
        revealedSquares.push(22);
    }
    if(hints>=3)
    {
        revealedSquares.push(0); //corner squares
        revealedSquares.push(4);
        revealedSquares.push(20);
        revealedSquares.push(24);
    }
    let letters = gameData[6]; //list of available letters
    let rowText = gameData[0]+"     "+gameData[1]+"     "+gameData[2];

    for(const square of revealedSquares)
    {
        let targetLetter = rowText[square];
        //get next available matching tile
        let index = letters.split('').findIndex((char, i) => char === targetLetter && !usedTiles.includes(i));
        usedTiles.push(index); //add to list of already used
        boardState[square]=index; //update board state
    }

    restoreBoardState();
    checkBoard();
    saveGameState();
    updateButtonVisibility();
}

/**
 * "share" clicked
 */
function handleShare() {
    let emojis = ""; //square emojis for grid display
    for (i=0;i<25;i++)
    {
        let emoji="⬜";
        if(i==6||i==8||i==16||i==18) emoji = "⬛";
        let color=getTileColor(i);
        if(color=="green") emoji="🟩";
        if(color=="red") emoji="🟥";
        emojis+=emoji;
        if(i%5==4) emojis+="\n";
    }

    const shareText = `#FiveByFive - Game #${gameNumber}\n${emojis}Words Found: ${wordsFound}\nMoves: ${moves}\nHints: ${hints}\nTime: ${formatSeconds(elapsed)}\nhttps://degroof.github.io/fivebyfive.html`;
    
    navigator.clipboard.writeText(shareText).then(() => {
		showToast("Results copied to clipboard.");
    });
}

//pop up toast, saying results have been copied
function showToast() {
  const toast = document.getElementById("toast");
  toast.className = "show";
  setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
}

//format seconds into hh:mm:ss
function formatSeconds(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Use padStart to ensure two digits for minutes and seconds
  const hDisplay = String(hours).padStart(2, '0');
  const mDisplay = String(minutes).padStart(2, '0');
  const sDisplay = String(seconds).padStart(2, '0');

  return `${hDisplay}:${mDisplay}:${sDisplay}`;
}

/**
 *set up event listeners
 */
function setupEventListeners() {
    //instructions
    instructionsToggle.addEventListener('click', () => {
        if (instructionsContent.style.display === 'none') {
            instructionsContent.style.display = 'block';
        } else {
            instructionsContent.style.display = 'none';
        }
    });
    
    giveUpBtn.addEventListener('click', handleGiveUp);
    shareBtn.addEventListener('click', handleShare);

    //"hint" button press/release
    hintBtn.addEventListener('mousedown', handleHintMouseDown);
    hintBtn.addEventListener('mouseup', handleHintMouseUp);
    hintBtn.addEventListener('touchstart', handleHintMouseDown, { passive: false });
    hintBtn.addEventListener('touchend', handleHintMouseUp, { passive: false });
    
    //"check" button press/release
    checkBtn.addEventListener('mousedown', handleCheckMouseDown);
    checkBtn.addEventListener('mouseup', handleCheckMouseUp);
    checkBtn.addEventListener('touchstart', handleCheckMouseDown, { passive: false });
    checkBtn.addEventListener('touchend', handleCheckMouseUp, { passive: false });

}
