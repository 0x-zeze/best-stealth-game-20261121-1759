// UMBRA HEIST — boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there. The game
// moves between five screens: title, play, paused, game over and win.
//
// ?shot=wide|shadow|spotted|hud stages that scene instead of running the loop,
// paints it twice and sets window.__shotReady (and the document title) for a
// screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createWorld, EVENT_CAUGHT, EVENT_WIN, EVENT_LOOT, EVENT_ALARM, EVENT_CHASE } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld();
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else {
      window.__shotReady = true;
      document.title = 'SHOT-READY';
    }
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput();
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Stay in the shadows, steal the Star Chart, reach the exit.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(won ? `Escaped unseen. Score ${world.state.score}.` : `Caught. Score ${world.state.score}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_RESTART && (screen === SCREEN_OVER || screen === SCREEN_WIN)) startGame();
    else if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) return;
    const events = world.step(STEP, input.direction());
    if (world.state.moving) audio.footstep(world.state.sneaking, performance.now());
    if (world.state.guard.stage === 2) audio.alarm(performance.now());
    if (events & EVENT_LOOT) {
      audio.loot();
      announce('Star Chart taken. Now reach the exit unseen.');
    }
    if (events & EVENT_ALARM) announce('Exposure full — the guard is coming for you.');
    if (events & EVENT_CHASE) announce('The guard is chasing you.');
    if (events & EVENT_WIN) {
      audio.win();
      endGame(true);
    } else if (events & EVENT_CAUGHT) {
      audio.caught();
      endGame(false);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Umbra Heist. Press Space to start. Move only in shadow.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
