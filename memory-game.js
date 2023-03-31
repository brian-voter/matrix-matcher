"use strict";

const GRAVITY = 0.7;
const FOUND_MATCH_WAIT_MSECS = 1000;
const CARD_BACKGROUND_COLOR = getComputedStyle(document.documentElement).getPropertyValue('--card-background-color');
const COLOR_BANK = ["red", "blue", "green", "orange", "purple", "pink", "yellow", "brown", "black", "navy", "teal", "maroon", "silver", "white"];
/** The number of cards in a game = level + BASE_CARD_COUNT */
const BASE_COLOR_COUNT = 3;
const MAX_LEVEL = COLOR_BANK.length - BASE_COLOR_COUNT - 1;

const MATRIX_CELL_COLOR_1 = "green";
const MATRIX_CELL_COLOR_2 = "black";
const MATRIX_CELL_SIZE_PX = 10;
const MIN_GROWTH_INTERVAL_MILLIS = 20;
const MAX_GROWTH_INTERVAL_MILLIS = 15000;
const GROWTH_INTERVAL_MULTIPLIER_DEFAULT = 0.8;

const CREDITS_TEXT = "Game: Brian Voter, 2023 <brian-voter.github.io>\n" +
  "Music: MORPHODER GROOVE by BOCrew (c)\n" +
  "'Hacked' Font by David Libeau <https://hackedfont.com/>\n" +
  "Interface Sound Effect by UNIVERSFIELD of <pixabay.com>\n" +
  "Other Sounds Effects: <pixabay.com>.";
const CREDITS_LINKS = ["https://brian-voter.github.io", "hackedfont.com/",
  "http://pixabay.com", "http://pixabay.com"];

class GAME_STATE {
  static DEFEAT = new GAME_STATE("DEFEATED");
  static VICTORY = new GAME_STATE("VICTORY");
  static PLAYING = new GAME_STATE("PLAYING");
  static READY = new GAME_STATE("READY");
  static START_SCREEN = new GAME_STATE("START_SCREEN");
  static LOADING = new GAME_STATE("LOADING");

  constructor(name) {
    this.name = name;
  }
}

let currentGameState = GAME_STATE.START_SCREEN;

/** all the cards created */
let cards = [];
/** The cards currently flipped by the user, length should be between 0 and 2 (inc) */
let cardsUp = [];
/** The number of cards successfully matched */
let matched = 0;
/** don't accept input while waiting e.g. we are waiting to flip cards back over  */
let waiting = false;
/** array of [width, height] of the document */
let docSize = undefined;
/** width of the document */
let maxWidth = undefined;
/** height of the document */
let maxHeight = undefined;

/** the speed at which cards move around */
let moveSpeed = 0;

/** the interval between growth events */
let growthInterval = MAX_GROWTH_INTERVAL_MILLIS;
let growthIntervalMultiplier = GROWTH_INTERVAL_MULTIPLIER_DEFAULT;
let growthGrid = undefined;
let growthPaused = false;

/** current game level */
let level = 1;

let gameBoard = undefined;
let powerUpContainer = undefined;
let matrixGrowthContainer = undefined;

/** ID of the repeating interval */
let growthRepeatIntervalID = undefined;
/** ID of the repeating interval */
let floatRepeatIntervalID = undefined;

/** An instance of each available {@link PowerUp} */
let powerUps = [];
/** For each powerUp in {@link powerUps}, the number of uses available */
let powerUpsAvailable = [];
/** For each powerUp in {@link powerUps}, the number of uses that were
 * available at the first attempt of the current level */
let powerUpsAvailableAtLevelStart = [];
let powerUpButtons = [];


document.addEventListener('DOMContentLoaded', onLoad);

/** Stuff to do when the page loads */
async function onLoad() {
  docSize = getDocSize();
  maxWidth = docSize[0];
  maxHeight = docSize[1];

  gameBoard = document.getElementById("gameBoard");
  matrixGrowthContainer = document.getElementById("matrixContainer");

  initPowerUps();

  addAudioToggle();

  addCreditsButton();

  let objectiveTextController = await renderText("OBJECTIVE: FIND ALL THE PAIRS BEFORE THE MATRIX ESCAPES CONTAINMENT",
    [maxWidth / 2, maxHeight / 2.5]);

  let continueButton = createButton(">>CONTINUE>>", [(maxWidth / 2), (maxHeight * 0.75)]);

  continueButton.addEventListener("click", () => {
    if (currentGameState == GAME_STATE.START_SCREEN) {
      playUIClickAudio();
      currentGameState = GAME_STATE.LOADING;
      document.body.removeChild(continueButton);
      objectiveTextController.flickerOut().then(prepareGame);
    }
  });
}

/**
 * Initializes each of the powerups, and sets the number of uses to start with. Does not add any buttons.
 */
function initPowerUps() {
  powerUpContainer = document.getElementById("powerupContainer");
  powerUps = [new MemoryWipe(0), new Underclock(1), new CodeLeak(2)];
  powerUpsAvailable = [0, 0, 0];
  powerUpsAvailableAtLevelStart = powerUpsAvailable.concat([]);
  powerUpButtons = new Array(powerUps.length);
  powerUpButtons.fill(null);
}

/** Prepares the current level, adding the cards and a start button */
async function prepareGame() {
  let colors = selectColors();
  createCards(colors);
  floatCards();
  let levelTextController = await renderText("LEVEL " + level,
    [maxWidth / 2, maxHeight * 0.4], undefined, "6em");

  let startButton = createButton(">>START GAME>>", [(maxWidth / 2), (maxHeight * 0.75)]);
  currentGameState = GAME_STATE.READY;

  startButton.addEventListener("click", () => {
    if (currentGameState == GAME_STATE.READY) {
      playUIClickAudio();
      currentGameState = GAME_STATE.LOADING;
      document.body.removeChild(startButton);
      levelTextController.flickerOut().then(startLevel);
    }
  });
}

/** Starts the current level, adds powerup buttons, starts the matrix growth */
function startLevel() {
  currentGameState = GAME_STATE.PLAYING;
  waiting = false;
  renderText("BEGIN!", [maxWidth / 2, maxHeight / 3], 2000, "6em");

  powerUpsAvailable = powerUpsAvailableAtLevelStart.concat([]);
  drawPowerUpButtons();

  startMatrixGrowth(MAX_GROWTH_INTERVAL_MILLIS);

  initialCueMusic();
}

/** removes all matrix cells from the document, based on those stored in the growthGrid */
function clearGrowthGrid() {
  for (let x = 0; x < growthGrid.length; x++) {
    for (let y = 0; y < growthGrid[0].length; y++) {
      if (growthGrid[x][y] != null) {
        matrixGrowthContainer.removeChild(growthGrid[x][y]);
      }
    }
  }
}

/** cleans up and resets variables after a level is completed */
function resetGame(clearGrid) {
  matched = 0;

  removePowerupButtons();

  growthIntervalMultiplier = GROWTH_INTERVAL_MULTIPLIER_DEFAULT;

  clearInterval(growthRepeatIntervalID);
  clearInterval(floatRepeatIntervalID);

  cardsUp = [];
  for (const card of cards) {
    gameBoard.removeChild(card);
  }
  cards = [];

  if (clearGrid) {
    clearGrowthGrid();
  }
}

/** creates the matrix growthGrid based on the doc size and the matrix cell size */
function createGrid() {
  let grid = new Array(Math.floor(maxWidth / MATRIX_CELL_SIZE_PX));
  for (let x = 0; x < grid.length; x++) {
    grid[x] = new Array(Math.floor(maxHeight / MATRIX_CELL_SIZE_PX));
    grid[x].fill(null);
  }

  return grid;
}

/** returns an array of shuffled colors that will be used based on the current level number */
function selectColors(bank) {
  let colorCount = BASE_COLOR_COUNT + level;

  let colors = [];
  for (let i = 0; i < colorCount; i++) {
    colors.push(COLOR_BANK[i]);
    colors.push(COLOR_BANK[i]);
  }

  return shuffle(colors);
}

/** Shuffle array items in-place and return shuffled array. */

function shuffle(items) {
  // This algorithm does a "perfect shuffle", where there won't be any
  // statistical bias in the shuffle (many naive attempts to shuffle end up not
  // be a fair shuffle). This is called the Fisher-Yates shuffle algorithm; if
  // you're interested, you can learn about it, but it's not important.

  for (let i = items.length - 1; i > 0; i--) {
    // generate a random index between 0 and i
    let j = Math.floor(Math.random() * i);
    // swap item at i <-> item at j
    [items[i], items[j]] = [items[j], items[i]];
  }

  return items;
}

/** Create card for every color in colors (each will appear twice)
 *
 * Each div DOM element will have:
 * - a class with the value of the color
 * - a click event listener for each card to handleCardClick
 */

function createCards(colors) {
  for (let i = 0; i < colors.length; i++) {
    let card = document.createElement("div");
    card.setAttribute("class", colors[i]);
    card.dataset.cardMatched = "unmatched";
    card.dataset.cardFlipped = "unFlipped";
    card.dataset.cardIndex = i;
    card.dataset.dropSpeed = 0;
    card.addEventListener("click", handleCardClick);
    gameBoard.appendChild(card);
    cards.push(card);
  }
}

/** Flip a card face-up. */

function flipCard(card) {
  growthInterval = Math.max(MIN_GROWTH_INTERVAL_MILLIS, growthInterval * growthIntervalMultiplier);
  card.dataset.cardFlipped = "flipped";
  card.style.backgroundColor = card.getAttribute("class");
  card.style.boxShadow = "0px 0px 10px " + card.getAttribute("class");
}

/** Flip a card face-down. */

function unFlipCard(card) {
  card.dataset.cardFlipped = "unFlipped";
  card.style.backgroundColor = CARD_BACKGROUND_COLOR;
  card.style.boxShadow = "0px 0px 10px " + CARD_BACKGROUND_COLOR;
}

/** Handle clicking on a card: this could be first-card or second-card. */

function handleCardClick(evt) {

  if (waiting || evt.target.dataset.cardMatched == "matched" || currentGameState != GAME_STATE.PLAYING) {
    return;
  }

  switch (cardsUp.length) {
    case 0:
      flipCard(evt.target);
      cardsUp.push(evt.target);
      break;
    case 1:

      // return if they click the same card twice
      if (cardsUp[0].dataset.cardIndex === evt.target.dataset.cardIndex) {
        return;
      }
      flipCard(evt.target);
      cardsUp.push(evt.target);
      break;
  }

  if (cardsUp.length === 2) {

    // if the cards are the same color but not the very same card
    if (cardsUp[0].getAttribute("class") === cardsUp[1].getAttribute("class")) {
      handleMatch();
    } else {
      waiting = true;
      setTimeout(handleMiss, FOUND_MATCH_WAIT_MSECS);
    }
  }
}

/** Two cards of different colors were flipped */
function handleMiss() {
  unFlipCard(cardsUp[0]);
  unFlipCard(cardsUp[1]);
  cardsUp = [];
  waiting = false;
}

/** Two cards of the same color were flipped */
function handleMatch() {
  cardsUp[0].dataset.cardMatched = "matched";
  cardsUp[1].dataset.cardMatched = "matched";
  cardsUp = [];
  matched += 2;

  playCardsMatchedAudio();

  if (matched === cards.length) {
    handleVictory();
  }
}

/** when a player has lost the current level */
async function handleDefeat() {
  removePowerupButtons();
  currentGameState = GAME_STATE.DEFEAT;
  waiting = true;

  setTimeout(async () => {
    let failTextController = await renderText("ERROR: ARRAY INDEX OUT OF BOUNDS [YOU HAVE BEEN DEFEATED]", [maxWidth / 2, maxHeight / 2.5]);
    let retryButton = createButton(">>RETRY LEVEL>>", [(maxWidth / 2), (maxHeight * 0.75)]);
    retryButton.addEventListener("click", async () => {
      document.body.removeChild(retryButton);
      playUIClickAudio();
      currentGameState = GAME_STATE.LOADING;
      await failTextController.flickerOut();
      resetGame(true);
      prepareGame();
    });
  }, 500);
}

/** when a level is completed */
async function handleVictory() {
  currentGameState = GAME_STATE.VICTORY;
  waiting = true;
  removePowerupButtons();
  await delay(1500);
  playLevelCompleteAudio();
  let levelTextController = await renderText("LEVEL " + level + " COMPLETE!", [maxWidth / 2, maxHeight / 2.5]);

  await unGrowMatrix();

  let continueButton = createButton(">>CONTINUE>>", [(maxWidth / 2), (maxHeight * 0.75)]);

  continueButton.addEventListener("click", async () => {
    document.body.removeChild(continueButton);
    playUIClickAudio();
    currentGameState = GAME_STATE.LOADING;
    await levelTextController.flickerOut();
    if (level == MAX_LEVEL) {
      clearInterval(growthRepeatIntervalID);
      clearInterval(floatRepeatIntervalID);
      renderText("CONGRATULATIONS, YOU BEAT THE GAME!", [maxWidth / 2, maxHeight / 2, 5]);
    } else {
      resetGame(false);
      await awardPowerups();
      level++;
      prepareGame();
    }
  });
}

/** awards the powerups that the player earned after finishing a level */
async function awardPowerups() {
  return new Promise(async (resolve, reject) => {
    for (let i = 0; i < powerUps.length; i++) {
      let p = powerUps[i];
      let numToAward = p.calcNumToAward(level);

      if (numToAward >= 1) {
        powerUpsAvailable[i] += numToAward;
        powerUpsAvailableAtLevelStart[i] = powerUpsAvailable[i];
        renderText("YOU EARNED A POWERUP!", [maxWidth / 2, maxHeight / 4], 4000);
        await renderText(p.getPowerUpName() + ": " + p.getDescription(), [maxWidth / 2, maxHeight * 0.7], 5000);
      } else {
        powerUpsAvailableAtLevelStart[i] = powerUpsAvailable[i];
      }
    }
    resolve();
  });
}

/** All matrix cells are deleted in sequence ("animated" one after another) */
function unGrowMatrix() {
  return new Promise((resolve, reject) => {
    let growth = matrixGrowthContainer.getElementsByClassName("growth");
    let timeout = 0;
    for (const e of growth) {
      setTimeout(() => {
        matrixGrowthContainer.removeChild(e);
      }, timeout);
      timeout += 2;
    }

    setTimeout(() => {
      resolve();
    }, timeout);
  });
}

/**
 * A promise that resolves after t milliseconds.
 */
function delay(t) {
  return new Promise((resolve) => setTimeout(resolve, t));
}

/**
 * Starts a repeating interval where after every {@link growthInterval} millis go by, a new matrix cell appears according
 * to a random walk. {@link growthInterval} is initally set to {@link startingInterval}
 */
function startMatrixGrowth(startingInterval) {
  growthGrid = createGrid();
  growthInterval = startingInterval;
  growthPaused = false;

  let grown = 0;
  let lastPos = [Math.floor(growthGrid.length / 2), Math.floor(growthGrid[0].length / 2)];
  let lastGrowth = Date.now();

  let id = setInterval(() => {
    if (currentGameState == GAME_STATE.PLAYING && !growthPaused) {
      if (Date.now() - lastGrowth >= growthInterval) {
        let el = document.createElement("div");
        el.setAttribute("class", "growth");
        matrixGrowthContainer.appendChild(el);
        el.style.width = MATRIX_CELL_SIZE_PX + "px";
        el.style.height = MATRIX_CELL_SIZE_PX + "px";
        let color = (grown++ % 2 == 0 ? MATRIX_CELL_COLOR_1 : MATRIX_CELL_COLOR_2);
        el.style.backgroundColor = color;

        //TODO: does this work?
        el.style.boxShadow = "-2px 2px 4px";

        lastGrowth = Date.now();
        lastPos = calcRandomWalk(lastPos);

        el.style.left = lastPos[0] * MATRIX_CELL_SIZE_PX + "px";
        el.style.top = lastPos[1] * MATRIX_CELL_SIZE_PX + "px";
        growthGrid[lastPos[0]][lastPos[1]] = el;

        if (isMatrixGrowthAtEdge(lastPos)) {
          handleDefeat();
        }
      }
    }
  }, MIN_GROWTH_INTERVAL_MILLIS);

  growthRepeatIntervalID = id;
}

/**
 * Returns true iff the [x, y] position is at or beyond the bounds of {@link growthGrid}
 */
function isMatrixGrowthAtEdge(position) {
  return position[0] <= 0 || position[0] >= growthGrid.length - 1
    || position[1] <= 0 || position[1] >= growthGrid[1].length - 1;
}

/**
 * Returns a position [x, y] starting from lastPos ([x, y]) such that the new position
 * is within the bounds of {@link growthGrid} and the new position is not already occupied.
 *
 * If all neighbouring cells are taken, the new position is the next available cell
 * when traveling in a straight line towards the nearest edge of the matrix
 */
function calcRandomWalk(lastPos) {

  let possiblePositions = [[-1, 0], [0, -1], [1, 0], [0, 1]]
    .map((pos) => [pos[0] + lastPos[0], pos[1] + lastPos[1]])
    .filter((pos) => {
      return pos[0] >= 0 && pos[1] >= 0 && pos[0] < growthGrid.length
        && pos[1] < growthGrid[0].length && growthGrid[pos[0]][pos[1]] == null;
    });

  if (possiblePositions.length > 0) {
    return possiblePositions[getRandomInt(0, possiblePositions.length)];
  }
  else {

    // determine the closest edge
    let distancesToEdge = [lastPos[0], lastPos[1],
    growthGrid.length - lastPos[0], growthGrid[0].length - lastPos[1]];

    let min = 0;
    for (let i = 1; i < distancesToEdge.length; i++) {
      if (distancesToEdge[i] < distancesToEdge[min]) {
        min = i;
      }
    }

    // the vector towards the closest edge
    let directionVector = [];

    switch (min) {
      case 0: directionVector = [-1, 0];
        break;
      case 1: directionVector = [0, -1];
        break;
      case 2: directionVector = [1, 0];
        break;
      case 3: directionVector = [0, 1];
        break;
    }

    let newPos = [lastPos[0] + directionVector[0], lastPos[1] + directionVector[1]];

    // walk towards the edge
    while (growthGrid[newPos[0]][newPos[1]] != null) {
      newPos = [newPos[0] + directionVector[0], newPos[1] + directionVector[1]];
    }

    return newPos;
  }
}

/** Make the cards float around, or drop if they've been matched */
function floatCards() {

  for (const card of cards) {
    const rect = card.getBoundingClientRect();
    const left = rect.left + "px";
    const top = rect.top + "px";
    setTimeout(() => {
      card.style.position = "absolute";
      card.style.left = left;
      card.style.top = top;
    }, 100);
  }

  let id = setInterval(() => {
    for (const card of cards) {
      if (card.dataset.cardMatched == "matched") {
        dropCard(card);
      } else {
        moveRandomly(card, moveSpeed);
      }
    }
  }, 25);

  floatRepeatIntervalID = id;
}

/** Applies gravity to a card */
function dropCard(card) {
  let oldX = Number(card.style.left.replace("px", ""));
  let oldY = Number(card.style.top.replace("px", ""));

  card.dataset.dropSpeed = Number(card.dataset.dropSpeed || 0) + GRAVITY;
  let boundedPos = confineToBounds(card, oldX, oldY + Number(card.dataset.dropSpeed));

  card.style.left = boundedPos[0] + "px";
  card.style.top = boundedPos[1] + "px";
}

/** Move an element randomly by (up to) the given distance
 *
 * @returns [x, y] the new position
*/
function moveRandomly(el, distance) {
  let oldX = Number(el.style.left.replace("px", ""));
  let oldY = Number(el.style.top.replace("px", ""));

  let boundedPos = confineToBounds(el, oldX + getRandom(-distance, distance), oldY + getRandom(-distance, distance));

  el.style.left = boundedPos[0] + "px";
  el.style.top = boundedPos[1] + "px";

  return boundedPos;
}

/** Returns [x, y] where x and y are fixed to within the bounds of the window,
 * given an element el (using it's size) */
function confineToBounds(el, x, y) {
  return [Math.min(maxWidth - el.offsetWidth, Math.max(el.offsetWidth, x)),
  Math.min(maxHeight - (el.offsetHeight + 20), Math.max(el.offsetHeight, y))];
}

/**
 * This example returns a random number between the specified values.
 * The returned value is no lower than (and may possibly equal) min, and is less than (and not equal) max.
 *
 * From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
 */
function getRandom(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * This example returns a random integer between the specified values.
 * The value is no lower than min (or the next integer greater than min if min
 * isn't an integer), and is less than (but not equal to) max.
 *
 * From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
 */
function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
}

//TODO: necessary?
/** Returns [width, height] according to the size of the document
 *
 * From: https://stackoverflow.com/a/1147768
*/
function getDocSize() {
  let body = document.body;
  let html = document.documentElement;

  let width = Math.max(body.scrollWidth, body.offsetWidth,
    html.clientWidth, html.scrollWidth, html.offsetWidth);

  let height = Math.max(body.scrollHeight, body.offsetHeight,
    html.clientHeight, html.scrollHeight, html.offsetHeight);

  return [width, height];
};