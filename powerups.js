"use strict";

/** The length of time for which all cards are visible after the use of a code leak powerup */
const CODE_LEAK_REVEAL_TIME_MILLIS = 3000;

class PowerUp {

  constructor() {
    if (this.constructor == PowerUp) {
      throw new Error("Abstract classes can't be instantiated.");
    }
  }

  /**
   * Activates the powerup. Currently this method needs to handle removing the button and adding it back if required.
   */
  usePowerUp() {
    throw new Error("Method 'usePowerup()' must be implemented.");
  }

  /**
   * Returns the number (0 or more) of powerups to be awarded for beating the specified level.
   */
  calcNumToAward(level) {
    throw new Error("Method 'calcNumToAward(level)' must be implemented.");
  }

  getPowerUpName() {
    throw new Error("Method 'getPowerUpName()' must be implemented.");
  }

  getDescription() {
    throw new Error("Method 'getDescription()' must be implemented.");
  }
}

class MemoryWipe extends PowerUp {

  constructor(powerUpIndex) {
    super();
    this.powerUpIndex = powerUpIndex;
  }

  usePowerUp() {
    growthPaused = true;
    let usesAvailTemp = powerUpsAvailable[this.powerUpIndex] - 1;
    powerUpsAvailable[this.powerUpIndex] = 0;
    drawPowerUpButtons();
    clearInterval(growthRepeatIntervalID);
    Promise.all([renderText("MEMORY WIPE IN PROGRESS...",
      [maxWidth / 2, maxHeight / 2], 3000), unGrowMatrix()]).then(() => {
        powerUpsAvailable[this.powerUpIndex] = usesAvailTemp;
        drawPowerUpButtons();
        startMatrixGrowth(growthInterval + 1000);
      });
  }

  calcNumToAward(level) {
    if (level % 2 == 0 || level >= 5) {
      return 1;
    } else {
      return 0;
    }
  }

  getPowerUpName() {
    return "MEMORY WIPE";
  }

  getDescription() {
    return "ERASES ALL EXISTING MATRIX CELLS"
  }
}

class Underclock extends PowerUp {

  constructor(powerUpIndex) {
    super();
    this.powerUpIndex = powerUpIndex;
  }

  async usePowerUp() {
    let usesAvailTemp = powerUpsAvailable[this.powerUpIndex] - 1;
    powerUpsAvailable[this.powerUpIndex] = 0;
    drawPowerUpButtons();

    growthIntervalMultiplier = Math.min(0.99, growthIntervalMultiplier + 0.05);
    growthInterval = MAX_GROWTH_INTERVAL_MILLIS / 2;

    await renderText("UNDERCLOCKING CPU...",
      [maxWidth / 2, maxHeight / 2], 2000);

    powerUpsAvailable[this.powerUpIndex] = usesAvailTemp;
    drawPowerUpButtons();
  }

  calcNumToAward(level) {
    if (level == 10 || (level % 2 == 0 && level >= 5)) {
      return 1;
    } else {
      return 0;
    }
  }

  getPowerUpName() {
    return "UNDERCLOCK";
  }

  getDescription() {
    return "SLOWS MATRIX CELL SPREAD"
  }
}

class CodeLeak extends PowerUp {

  constructor(powerUpIndex) {
    super();
    this.powerUpIndex = powerUpIndex;
  }

  async usePowerUp() {
    let usesAvailTemp = powerUpsAvailable[this.powerUpIndex] - 1;
    powerUpsAvailable[this.powerUpIndex] = 0;
    drawPowerUpButtons();

    await renderText("DECRYPTING MATRIX CODE...",
      [maxWidth / 2, maxHeight / 2], 2000);

    for (const card of cards) {
      if (card.dataset.cardMatched == "unmatched") {
        card.style.backgroundColor = card.getAttribute("class");
        card.style.boxShadow = "0px 0px 10px " + card.getAttribute("class");
      }
    }

    await delay(CODE_LEAK_REVEAL_TIME_MILLIS);
    for (const card of cards) {
      if (card.dataset.cardMatched == "unmatched" && card.dataset.cardFlipped != "flipped") {
        card.style.backgroundColor = CARD_BACKGROUND_COLOR;
        card.style.boxShadow = "0px 0px 10px " + CARD_BACKGROUND_COLOR;
      }
      await delay(100);
    }

    await delay(100);
    powerUpsAvailable[this.powerUpIndex] = usesAvailTemp;
    drawPowerUpButtons();
  }

  calcNumToAward(level) {
    if (level >= 8) {
      return 1;
    } else {
      return 0;
    }
  }

  getPowerUpName() {
    return "CODE LEAK";
  }

  getDescription() {
    return "TEMPORARILY REVEAL ALL ENEMY BLOCKS"
  }
}