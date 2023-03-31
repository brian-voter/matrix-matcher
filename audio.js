"use strict";

const MUSIC_SOURCE = "sound/BOCrew_-_MORPHODER_GROOVE.mp3"

let audioEnabled = true;
let musicAudio = undefined;

let interfaceClickAudio = new Audio("sound/interface-quick.mp3");
let cardsMatchedAudio = new Audio("sound/breaking-glass-quick.mp3");
let levelCompleteAudio = new Audio("sound/success-quick.mp3");

/** Adds a button to toggle the game audio on/off */
function addAudioToggle() {
  let audioButton = createButton("AUDIO: " + (audioEnabled ? "ON!" : "OFF"), undefined, "1em");
  audioButton.style.position = "absolute";

  audioButton.style.right = "20px";
  audioButton.style.top = "20px";

  audioButton.addEventListener("click", () => {
    audioEnabled = !audioEnabled;
    audioButton.innerText = "AUDIO: " + (audioEnabled ? "ON!" : "OFF");
    updateMusicState();
  });
}

/** Starts or resumes music if {@link audioEnabled} is true, otherwise pauses it. */
function updateMusicState() {
  return new Promise(async (resolve, reject) => {
    if (audioEnabled) {
      if (musicAudio == undefined) {
        musicAudio = new Audio(MUSIC_SOURCE);
        musicAudio.loop = true;
      }
      await musicAudio.play();
      resolve();
    } else {
      if (musicAudio != undefined) {
        musicAudio.pause();
      }
    }
    resolve();
  })
}

/** Starts music if {@link audioEnabled} is true */
function initialCueMusic() {
  return new Promise(async (resolve, reject) => {
    if (audioEnabled) {
      if (musicAudio == undefined) {
        musicAudio = new Audio(MUSIC_SOURCE);
        musicAudio.loop = true;
        await musicAudio.play();
        resolve();
      }
    }
    resolve();
  })
}

function playUIClickAudio() {
  if (audioEnabled) {
    interfaceClickAudio.currentTime = 0;
    interfaceClickAudio.play();
  }
}

function playCardsMatchedAudio() {
  if (audioEnabled) {
    cardsMatchedAudio.currentTime = 0;
    cardsMatchedAudio.play();
  }
}

function playLevelCompleteAudio() {
  if (audioEnabled) {
    levelCompleteAudio.currentTime = 0;
    levelCompleteAudio.play();
  }
}