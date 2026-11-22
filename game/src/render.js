// UMBRA HEIST — the renderer: a dark museum floor at night, warm pools of lamp
// light, deep blue shadow, visible vision cones, marble walls, a red carpet,
// statues for cover, and the HUD (exposure meter, guard stage, loot, timer, room).
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, HUD_HEIGHT, FIELD, WALLS, STATUES, LIGHTS,
  LOOT, EXIT, GUARD, CCTV, PLAYER, ROOMS,
} from './config.js';
import { STAGE_CALM, STAGE_SUSPICIOUS, STAGE_CHASE, inLight } from './world.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;
export const SCREEN_WIN = 4;

function roomName(x) {
  for (const room of ROOMS) {
    if (x >= room.x0 && x < room.x1) return room.name;
  }
  return ROOMS[2].name;
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function stageLabel(stage) {
  return stage === STAGE_CHASE ? 'CHASING !' : stage === STAGE_SUSPICIOUS ? 'SUSPICIOUS ?' : 'CALM';
}

function stageColor(stage) {
  return stage === STAGE_CHASE ? '#ff5252' : stage === STAGE_SUSPICIOUS ? '#ffc93c' : '#7ee081';
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const scale = { x: 1, y: 1 };
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    scale.x = canvas.width / CANVAS_WIDTH;
    scale.y = canvas.height / CANVAS_HEIGHT;
  }
  window.addEventListener('resize', resize);
  resize();

  return { draw };

  function draw(state, screen, best) {
    ctx.setTransform(scale.x, 0, 0, scale.y, 0, 0);
    drawBackdrop(state);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_OVER) drawEnd(state, false, best);
    else if (screen === SCREEN_WIN) drawEnd(state, true, best);
    else {
      if (screen === SCREEN_PAUSED) drawPausedBanner();
    }
  }

  /** Floor, carpet, walls, light pools, shadow, cones, statues, loot, exit, actors. */
  function drawBackdrop(state) {
    // Night museum floor: near-black blue marble with faint tile seams.
    ctx.fillStyle = '#10131f';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.strokeStyle = 'rgba(120,140,200,0.07)';
    ctx.lineWidth = 1;
    for (let x = FIELD.x; x <= FIELD.x + FIELD.width; x += 88) {
      ctx.beginPath(); ctx.moveTo(x, FIELD.y); ctx.lineTo(x, FIELD.y + FIELD.height); ctx.stroke();
    }
    for (let y = FIELD.y; y <= FIELD.y + FIELD.height; y += 88) {
      ctx.beginPath(); ctx.moveTo(FIELD.x, y); ctx.lineTo(FIELD.x + FIELD.width, y); ctx.stroke();
    }
    // Red carpet runner through all three rooms.
    ctx.fillStyle = '#5e1620';
    ctx.fillRect(FIELD.x, 352, FIELD.width, 56);
    ctx.fillStyle = '#7d1f2b';
    ctx.fillRect(FIELD.x, 360, FIELD.width, 40);
    ctx.strokeStyle = '#c9a227';
    ctx.strokeRect(FIELD.x + 2, 362, FIELD.width - 4, 36);

    // Deep blue shadow wash over the whole floor; light pools cut through it.
    ctx.fillStyle = 'rgba(6,10,34,0.42)';
    ctx.fillRect(FIELD.x, FIELD.y, FIELD.width, FIELD.height);
    for (const light of LIGHTS) {
      const gradient = ctx.createRadialGradient(light.x, light.y, 8, light.x, light.y, light.r);
      gradient.addColorStop(0, 'rgba(255,214,150,0.85)');
      gradient.addColorStop(0.55, 'rgba(255,190,110,0.38)');
      gradient.addColorStop(1, 'rgba(255,190,110,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.arc(light.x, light.y, light.r, 0, Math.PI * 2); ctx.fill();
    }
    // Lamp fixtures at each pool.
    for (const light of LIGHTS) {
      ctx.fillStyle = '#ffd694';
      ctx.beginPath(); ctx.arc(light.x, light.y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,214,148,0.7)';
      ctx.beginPath(); ctx.arc(light.x, light.y, 9, 0, Math.PI * 2); ctx.stroke();
    }

    drawExit();
    drawStatues();
    drawLoot(state);
    drawCctvCone(state);
    drawGuardCone(state);
    drawGuard(state);
    drawPlayer(state);
    drawWalls();
    drawHud(state);
  }

  function drawWalls() {
    ctx.fillStyle = '#3a3f5c';
    ctx.fillRect(FIELD.x - 8, FIELD.y - 8, FIELD.width + 16, 10);
    ctx.fillRect(FIELD.x - 8, FIELD.y + FIELD.height - 2, FIELD.width + 16, 10);
    ctx.fillRect(FIELD.x - 8, FIELD.y - 8, 10, FIELD.height + 16);
    ctx.fillRect(FIELD.x + FIELD.width - 2, FIELD.y - 8, 10, FIELD.height + 16);
    for (const wall of WALLS) {
      ctx.fillStyle = '#454a68';
      ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
      ctx.fillStyle = '#5b6186';
      ctx.fillRect(wall.x, wall.y, wall.width, 3);
    }
    // Door frames glow faintly so the passages read at a glance.
    ctx.fillStyle = 'rgba(255,214,148,0.25)';
    ctx.fillRect(440, 330, 10, 100);
    ctx.fillRect(840, 330, 10, 100);
    ctx.fillStyle = '#8b90ad';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GALLERY WEST', 232, 108);
    ctx.fillText('STAR CHART HALL', 645, 108);
    ctx.fillText('VAULT EAST', 1048, 108);
  }

  function drawExit() {
    const pulse = 0.75 + 0.25 * Math.sin(Date.now() / 350);
    ctx.fillStyle = `rgba(46,204,113,${0.55 * pulse})`;
    ctx.fillRect(EXIT.x, EXIT.y, EXIT.w, EXIT.h);
    ctx.strokeStyle = '#2ecc71';
    ctx.lineWidth = 3;
    ctx.strokeRect(EXIT.x, EXIT.y, EXIT.w, EXIT.h);
    ctx.fillStyle = '#eafff1';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', EXIT.x + EXIT.w / 2, EXIT.y + EXIT.h / 2 + 5);
  }

  function drawStatues() {
    for (const statue of STATUES) {
      ctx.fillStyle = '#232742';
      ctx.fillRect(statue.x - 4, statue.y - 4, statue.w + 8, statue.h + 8);
      ctx.fillStyle = '#c8ccd9';
      ctx.fillRect(statue.x, statue.y, statue.w, statue.h);
      ctx.fillStyle = '#8f96b0';
      ctx.beginPath();
      ctx.arc(statue.x + statue.w / 2, statue.y + statue.h / 2, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5d6480';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(statue.label, statue.x + statue.w / 2, statue.y + statue.h + 14);
    }
  }

  function drawLoot(state) {
    if (state.lootTaken) return;
    const bob = Math.sin(Date.now() / 300) * 3;
    ctx.save();
    ctx.translate(LOOT.x, LOOT.y + bob);
    ctx.fillStyle = 'rgba(255,215,0,0.25)';
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    for (let i = 0; i < 5; i += 1) {
      const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
      const x = Math.cos(a) * 15;
      const y = Math.sin(a) * 15;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7a5c00';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STAR CHART', 0, 30);
    ctx.restore();
  }

  function drawCone(ox, oy, angle, halfAngle, range, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.arc(ox, oy, range, angle - halfAngle, angle + halfAngle);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = color.replace('0.30', '0.55').replace('0.22', '0.45');
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + Math.cos(angle - halfAngle) * range, oy + Math.sin(angle - halfAngle) * range);
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + Math.cos(angle + halfAngle) * range, oy + Math.sin(angle + halfAngle) * range);
    ctx.stroke();
  }

  function drawCctvCone(state) {
    drawCone(CCTV.x, CCTV.y, state.cctv.angle, CCTV.halfAngle, CCTV.range, 'rgba(255,60,60,0.22)');
    // CCTV camera body on the wall.
    ctx.fillStyle = '#2b2f45';
    ctx.fillRect(CCTV.x - 12, CCTV.y - 8, 24, 12);
    ctx.fillStyle = state.cctvSeesPlayer ? '#ff3b3b' : '#ff8a8a';
    ctx.beginPath(); ctx.arc(CCTV.x, CCTV.y + 8, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffb3b3';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CCTV', CCTV.x, CCTV.y + 26);
  }

  function drawGuardCone(state) {
    const guard = state.guard;
    const color = guard.stage === STAGE_CHASE
      ? 'rgba(255,70,50,0.34)'
      : guard.stage === STAGE_SUSPICIOUS ? 'rgba(255,200,60,0.30)' : 'rgba(255,220,90,0.26)';
    drawCone(guard.x, guard.y, guard.angle, GUARD.visionHalfAngle, GUARD.visionRange, color);
  }

  function drawGuard(state) {
    const guard = state.guard;
    ctx.fillStyle = '#1c2438';
    ctx.beginPath(); ctx.arc(guard.x, guard.y, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = guard.stage === STAGE_CHASE ? '#ff5252' : guard.stage === STAGE_SUSPICIOUS ? '#ffc93c' : '#e8b64c';
    ctx.beginPath(); ctx.arc(guard.x, guard.y, 13, 0, Math.PI * 2); ctx.fill();
    // Facing tick.
    ctx.strokeStyle = '#1c2438';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(guard.x + Math.cos(guard.angle) * 16, guard.y + Math.sin(guard.angle) * 16);
    ctx.stroke();
    // Suspicion mark above the guard.
    if (guard.stage !== STAGE_CALM) {
      ctx.fillStyle = guard.stage === STAGE_CHASE ? '#ff5252' : '#ffc93c';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(guard.stage === STAGE_CHASE ? '!' : '?', guard.x, guard.y - 22);
    }
    ctx.fillStyle = '#dfe3f0';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GUARD', guard.x, guard.y + 28);
  }

  function drawPlayer(state) {
    const player = state.player;
    const lit = inLight(player.x, player.y);
    // Ring: amber in light (exposed), cyan in shadow (safe).
    ctx.strokeStyle = lit ? '#ffb347' : '#4dd8ff';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(player.x, player.y, PLAYER.radius + 4, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#10131f';
    ctx.beginPath(); ctx.arc(player.x, player.y, PLAYER.radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = lit ? '#ffb347' : '#4dd8ff';
    ctx.beginPath(); ctx.arc(player.x, player.y, PLAYER.radius - 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#dfe3f0';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.sneaking ? 'SNEAKING' : 'YOU', player.x, player.y + 26);
  }

  function drawHud(state) {
    ctx.fillStyle = '#0b0e1a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, HUD_HEIGHT);
    ctx.strokeStyle = '#2c3352';
    ctx.beginPath(); ctx.moveTo(0, HUD_HEIGHT); ctx.lineTo(CANVAS_WIDTH, HUD_HEIGHT); ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd694';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('UMBRA HEIST', 24, 28);
    ctx.fillStyle = '#8b90ad';
    ctx.font = '12px sans-serif';
    ctx.fillText('move only in shadow', 24, 48);

    // Exposure meter.
    const meterX = 300;
    const meterW = 260;
    ctx.fillStyle = '#e8eaf2';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('EXPOSURE', meterX, 24);
    ctx.fillStyle = '#232742';
    ctx.fillRect(meterX, 30, meterW, 16);
    const exposureColor = state.exposure > 70 ? '#ff5252' : state.exposure > 35 ? '#ffc93c' : '#7ee081';
    ctx.fillStyle = exposureColor;
    ctx.fillRect(meterX, 30, Math.max(2, (meterW * state.exposure) / 100), 16);
    ctx.strokeStyle = '#8b90ad';
    ctx.strokeRect(meterX, 30, meterW, 16);
    ctx.fillStyle = '#e8eaf2';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${Math.round(state.exposure)}%`, meterX + meterW + 10, 43);
    const playerLit = inLight(state.player.x, state.player.y);
    ctx.fillStyle = playerLit ? '#ffb347' : '#4dd8ff';
    ctx.fillText(playerLit ? 'IN LIGHT — EXPOSED' : 'IN SHADOW — HIDDEN', meterX, 60);

    // Guard stage.
    ctx.fillStyle = '#e8eaf2';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('GUARD', 640, 24);
    ctx.fillStyle = stageColor(state.guard.stage);
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(stageLabel(state.guard.stage), 640, 44);
    ctx.fillStyle = '#8b90ad';
    ctx.font = '11px sans-serif';
    ctx.fillText(`suspicion ${Math.round(state.guard.suspicion)}`, 640, 60);

    // Loot, timer, room.
    ctx.fillStyle = '#e8eaf2';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('LOOT', 830, 24);
    ctx.fillStyle = state.lootTaken ? '#ffd700' : '#8b90ad';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(state.lootTaken ? '★ STAR CHART' : '☆ none yet', 830, 44);
    ctx.fillStyle = '#e8eaf2';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('TIME', 1030, 24);
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(formatTime(state.time), 1030, 44);
    ctx.fillStyle = '#8b90ad';
    ctx.font = '11px sans-serif';
    ctx.fillText(roomName(state.player.x), 1030, 60);
    ctx.fillStyle = '#e8eaf2';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('SCORE', 1145, 24);
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(String(state.score), 1145, 44);
    ctx.fillStyle = '#8b90ad';
    ctx.font = '11px sans-serif';
    ctx.fillText('WASD · Shift sneak', 1145, 60);
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(5,7,16,0.72)';
    ctx.fillRect(0, HUD_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - HUD_HEIGHT);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd694';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('UMBRA HEIST', CANVAS_WIDTH / 2, 250);
    ctx.fillStyle = '#e8eaf2';
    ctx.font = '22px sans-serif';
    ctx.fillText('Move only in shadow. Steal the Star Chart. Leave unseen.', CANVAS_WIDTH / 2, 295);
    ctx.fillStyle = '#b9bed4';
    ctx.font = '17px sans-serif';
    ctx.fillText('WASD / arrows — move (fast in shadow, slow in light)   ·   Shift — sneak (slow, silent, no exposure)', CANVAS_WIDTH / 2, 350);
    ctx.fillText('Yellow cone — the guard\'s eyes.  Red cone — the CCTV.  "?" he is suspicious.  "!" he is chasing you.', CANVAS_WIDTH / 2, 380);
    ctx.fillText('Light fills your EXPOSURE meter. At 100% the guard is called. Reach the green EXIT.', CANVAS_WIDTH / 2, 410);
    ctx.fillStyle = '#7ee081';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Press Space or Enter to begin', CANVAS_WIDTH / 2, 470);
    if (best > 0) {
      ctx.fillStyle = '#8b90ad';
      ctx.font = '15px sans-serif';
      ctx.fillText(`Best score: ${best}`, CANVAS_WIDTH / 2, 505);
    }
  }

  function drawPausedBanner() {
    ctx.fillStyle = 'rgba(5,7,16,0.55)';
    ctx.fillRect(0, HUD_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - HUD_HEIGHT);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8eaf2';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText('PAUSED', CANVAS_WIDTH / 2, 360);
    ctx.font = '17px sans-serif';
    ctx.fillText('Press P or Space to continue', CANVAS_WIDTH / 2, 400);
  }

  function drawEnd(state, won, best) {
    ctx.fillStyle = won ? 'rgba(6,26,14,0.78)' : 'rgba(30,6,10,0.78)';
    ctx.fillRect(0, HUD_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - HUD_HEIGHT);
    ctx.textAlign = 'center';
    if (won) {
      ctx.fillStyle = '#7ee081';
      ctx.font = 'bold 54px sans-serif';
      ctx.fillText(state.lootTaken ? 'UNSEEN — ESCAPED WITH THE STAR CHART' : 'ESCAPED — UNSEEN', CANVAS_WIDTH / 2, 300);
      ctx.fillStyle = '#e8eaf2';
      ctx.font = '20px sans-serif';
      ctx.fillText(state.lootTaken ? 'The museum never knew you were there.' : 'You slipped out — but the Star Chart still hangs in the hall.', CANVAS_WIDTH / 2, 345);
    } else {
      ctx.fillStyle = '#ff5252';
      ctx.font = 'bold 54px sans-serif';
      ctx.fillText('CAUGHT IN THE LIGHT', CANVAS_WIDTH / 2, 300);
      ctx.fillStyle = '#e8eaf2';
      ctx.font = '20px sans-serif';
      ctx.fillText('The guard found you. Stay in the shadows next time.', CANVAS_WIDTH / 2, 345);
    }
    ctx.fillStyle = '#b9bed4';
    ctx.font = '18px sans-serif';
    ctx.fillText(`Score ${state.score}   ·   Time ${formatTime(state.time)}   ·   Best ${Math.max(best, state.score)}`, CANVAS_WIDTH / 2, 395);
    ctx.fillStyle = '#7ee081';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Press R to try again', CANVAS_WIDTH / 2, 445);
  }
}
