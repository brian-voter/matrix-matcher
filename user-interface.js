"use strict";

/**
 *  Creates a div acting as a stylized button.
 *
 * @param {*} text The button's text
 * @param {*} centerPosition If defined, the position where the center of the button appears on the document
 * @param {*} fontSizeString The fontSize for the button's text
 * @returns the div
 */
function createButton(text, centerPosition, fontSizeString) {
  let button = document.createElement("div");
  button.setAttribute("class", "fancyButton");
  button.innerText = text;
  if (fontSizeString != undefined) {
    button.style.fontSize = fontSizeString;
  }
  document.body.appendChild(button);
  const rect = button.getBoundingClientRect();
  if (centerPosition != undefined) {
    button.style.position = "absolute";
    button.style.left = (centerPosition[0] - (rect.width / 2)) + "px";
    button.style.top = (centerPosition[1] - (rect.height / 2)) + "px";
  }
  return button;
}

/** Adds the activation buttons for all powerups */
function drawPowerUpButtons() {
  for (let i = 0; i < powerUps.length; i++) {
    if (powerUpButtons[i] != null) {
      powerUpContainer.removeChild(powerUpButtons[i]);
      powerUpButtons[i] = null;
    }

    if (currentGameState == GAME_STATE.PLAYING && powerUpsAvailable[i] >= 1) {
      let b = createButton(powerUps[i].getPowerUpName() + ": " + powerUpsAvailable[i], undefined, "2em");
      b.addEventListener("click", () => {
        playUIClickAudio();
        powerUps[i].usePowerUp();
      });
      powerUpContainer.appendChild(b);
      powerUpButtons[i] = b;
    }
  }
}

/** removes all powerup buttons */
function removePowerupButtons() {
  for (let i = 0; i < powerUps.length; i++) {
    if (powerUpButtons[i] != null) {
      powerUpContainer.removeChild(powerUpButtons[i]);
      powerUpButtons[i] = null;
    }
  }
}

/** Adds a button to display the credits info */
function addCreditsButton() {
  let creditsButton = createButton("ABOUT", undefined, "1em");

  let creditsOpen = false;

  creditsButton.style.position = "absolute";

  creditsButton.style.right = "20px";
  creditsButton.style.bottom = "20px";

  creditsButton.addEventListener("click", async () => {
    if (!creditsOpen) {
      creditsOpen = true;

      playUIClickAudio();
      const textController = await renderText(CREDITS_TEXT, [maxWidth / 2, maxHeight / 2],
        undefined, "1.5em", 9999, true, true, CREDITS_LINKS);

      let clickOutsideToCloseHandler = (e) => {
        if (!textController.container.contains(e.target)) {
          e.preventDefault();
          e.stopPropagation();
          textController.delete();
          document.removeEventListener("click", clickOutsideToCloseHandler);
          creditsOpen = false;
        }
      };
      document.addEventListener("click", clickOutsideToCloseHandler);
    }
  });
}

/**
 * Displays the given text, where each letter appears in sequence
 *
 * @param {*} text The text to display
 * @param {*} centerPosition [x, y] position in the document at which the center of the text will appear
 * @param {*} removeAfterMillis optional - If defined, the text will disappear in sequence after the specified number
 * of milliseconds. In this case, the promise waits to resolve after this time has elapsed.
 * @param {*} fontSizeString optional - sets the fontSize of each letter of the text
 * @param {*} startingZIndex optional - The zIndex of the first letter, which will decline by 1 per letter to render correctly
 * @param {*} dialogStyle If true, the container div will have a dark, nearly opaque background applied.
 * @param {*} enablePointerEvents If true, the text will receive pointer events.
 * @param {*} links optional - array of links. If provided, text segments in {@link text} enclosed
 * in <> brackets will link to the URLs provided in order of apperance in the array
 * @returns
 */
function renderText(text, centerPosition, removeAfterMillis, fontSizeString, startingZIndex,
  dialogStyle, enablePointerEvents, links) {
  return new Promise(async (resolve, reject) => {
    let pointerEvents = enablePointerEvents ? "auto" : "none";

    let container = document.createElement("div");
    container.setAttribute("class", "renderedTextPart");
    container.style.pointerEvents = pointerEvents;
    document.body.appendChild(container);

    let zIndex = startingZIndex != undefined ? startingZIndex : 300;

    if (dialogStyle) {
      container.style.zIndex = zIndex - text.length - 1;
      container.setAttribute("class", "renderedTextDialog");
    } else {
      container.setAttribute("class", "renderedTextContainer");
    }

    let letters = [];
    let curDiv = undefined;

    let currentLinkIndex = -1;
    let currentLink = null;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];

      console.log("letter: " + c);

      if (c == "<" && links != undefined) {
        currentLinkIndex++;
        if (currentLinkIndex >= links.length) {
          throw new Error("RenderedText link brackets '<>' do not match input number of links to display!");
        }
        currentLink = links[currentLinkIndex];
        continue;
      }

      else if (c == ">" && links != undefined) {
        currentLink = null;
        continue;
      }

      else if (c == "\n") {
        if (curDiv != undefined) {
          container.appendChild(curDiv);
          curDiv = undefined;
        }
        let lineBreakDiv = document.createElement("div");
        container.appendChild(lineBreakDiv);
        lineBreakDiv.innerText = "ㅤ";
        if (fontSizeString != undefined) {
          lineBreakDiv.style.height = fontSizeString;
          lineBreakDiv.style.fontSize = fontSizeString;
        }
        lineBreakDiv.setAttribute("class", "renderedTextLineBreaker");
        lineBreakDiv.style.pointerEvents = pointerEvents;
        continue;
      }

      else if (c == ' ') {
        if (curDiv != undefined) {
          container.appendChild(curDiv);
          curDiv = undefined;
        }
      }

      if (curDiv == undefined) {
        curDiv = document.createElement("div");
        curDiv.setAttribute("class", "renderedWord");
        curDiv.style.pointerEvents = pointerEvents;
        if (currentLink != null) {
          curDiv.innerHTML = curDiv.innerHTML + "<a href=\"" + currentLink + "\" target=\"_blank\"></a>";
        }
      }

      let letter = document.createElement("div");
      letter.setAttribute("class", "renderedLetter");
      letter.style.zIndex = zIndex--;
      letter.style.pointerEvents = pointerEvents;
      let insertText = c == ' ' ? '&nbsp;' : c;
      if (currentLink != null) {
        letter.innerHTML = letter.innerHTML + "<a href=\"" + currentLink + "\" target=\"_blank\">" + insertText + "</a>";
      } else {
        letter.innerText = insertText;
      }
      if (fontSizeString != undefined) {
        letter.style.fontSize = fontSizeString;
      }

      curDiv.appendChild(letter);
      letters.push(letter);
    }

    container.appendChild(curDiv);

    const rect = container.getBoundingClientRect();
    container.style.left = (centerPosition[0] - (rect.width / 2)) + "px";
    container.style.top = (centerPosition[1] - (rect.height / 2)) + "px";

    for (const letter of letters) {
      letter.style.visibility = "visible";
      await delay(40);
    }

    let deleted = false;

    let deleteFun = function () {
      if (!deleted) {
        document.body.removeChild(container);
        deleted = true;
      }
    };

    let flickerOutFun = function () {
      return new Promise(async (fResolve, fReject) => {
        if (!deleted) {
          for (const letter of letters) {
            letter.style.visibility = "hidden";
            await delay(20);
          }

          await delay(20);
          deleteFun();
          fResolve();
        }
      });
    };

    let textController = {
      delete: deleteFun,
      flickerOut: flickerOutFun,
      container: container,
    };

    if (removeAfterMillis != undefined) {
      await delay(removeAfterMillis);
      await flickerOutFun();
      resolve(textController);
    } else {
      resolve(textController);
    }
  });
}
