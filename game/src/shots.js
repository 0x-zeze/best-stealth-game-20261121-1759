// UMBRA HEIST — the four screenshot scenes (?shot=wide|shadow|spotted|hud).
// Each one stages the real world state directly (positions, exposure, suspicion)
// and lets the renderer paint it, so every shot is a true render of the game.
import { SCREEN_PLAY } from './render.js';
import { STAGE_CALM, STAGE_SUSPICIOUS, STAGE_CHASE } from './world.js';

/**
 * Stage the named scene on a fresh world and return the screen to draw.
 * Unknown names fall back to the wide shot.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  const guard = state.guard;
  if (name === 'shadow') {
    // Close-up of the shadow mechanic: the player at the edge of the bright
    // lamp over the Star Chart, exposure already climbing.
    state.player.x = 640; state.player.y = 340;
    state.exposure = 62;
    guard.x = 500; guard.y = 560; guard.angle = -Math.PI / 2;
    guard.stage = STAGE_CALM; guard.suspicion = 18;
    state.cctv.angle = Math.PI / 2;
  } else if (name === 'spotted') {
    // The near-miss: the guard has turned, "!" overhead, cone on the player.
    state.player.x = 600; state.player.y = 300;
    state.exposure = 88;
    guard.x = 700; guard.y = 300; guard.angle = Math.PI;
    guard.stage = STAGE_CHASE; guard.suspicion = 96;
    guard.lastSeen = { x: 600, y: 300 };
    state.cctv.angle = Math.PI / 2 + 0.6;
  } else if (name === 'hud') {
    // The goal: Star Chart taken, player at the green EXIT, exposure low.
    state.lootTaken = true;
    state.score = 500;
    state.time = 74;
    state.player.x = 1180; state.player.y = 540;
    state.exposure = 12;
    guard.x = 500; guard.y = 200; guard.angle = 0;
    guard.stage = STAGE_CALM; guard.suspicion = 5;
    state.cctv.angle = Math.PI / 2 - 0.5;
  } else {
    // wide: the whole museum in one frame — level, guard cone, light/shadow
    // contrast, a statue, the loot, the exit and the exposure meter.
    state.player.x = 150; state.player.y = 620;
    state.exposure = 35;
    guard.x = 640; guard.y = 200; guard.angle = 0;
    guard.stage = STAGE_SUSPICIOUS; guard.suspicion = 47;
    guard.lastSeen = { x: 500, y: 300 };
    state.cctv.angle = Math.PI / 2 + 0.4;
    state.time = 23;
  }
  return { screen: SCREEN_PLAY, best: 0 };
}
