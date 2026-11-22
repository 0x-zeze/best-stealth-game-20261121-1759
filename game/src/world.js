// UMBRA HEIST — pure world simulation (no DOM, no canvas): movement, light and
// shadow, the exposure meter, the guard's 3-stage suspicion, the CCTV sweep, the
// loot and the exit. main.js drives it; render.js only paints the state.
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, FIELD, WALLS, STATUES, LIGHTS, LOOT, EXIT,
  GUARD, GUARD_START, GUARD_WAYPOINTS, CCTV, PLAYER, EXPOSURE, STEP,
} from './config.js';

export const EVENT_CAUGHT = 1;
export const EVENT_LOOT = 2;
export const EVENT_WIN = 4;
export const EVENT_ALARM = 8;
export const EVENT_CHASE = 16;

export const STAGE_CALM = 0;
export const STAGE_SUSPICIOUS = 1;
export const STAGE_CHASE = 2;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/** True when the segment a->b crosses the rectangle (a statue blocks sight). */
export function segmentBlocked(ax, ay, bx, by, rect) {
  const dx = bx - ax;
  const dy = by - ay;
  let tmin = 0;
  let tmax = 1;
  if (dx === 0) {
    if (ax < rect.x || ax > rect.x + rect.w) return false;
  } else {
    let t1 = (rect.x - ax) / dx;
    let t2 = (rect.x + rect.w - ax) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (dy === 0) {
    if (ay < rect.y || ay > rect.y + rect.h) return false;
  } else {
    let t1 = (rect.y - ay) / dy;
    let t2 = (rect.y + rect.h - ay) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

function lineOfSight(ax, ay, bx, by) {
  for (const statue of STATUES) {
    if (segmentBlocked(ax, ay, bx, by, statue)) return false;
  }
  return true;
}

function pointInRect(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}

/** True when (x, y) stands inside any warm light pool. */
export function inLight(x, y) {
  for (const light of LIGHTS) {
    if (distance(x, y, light.x, light.y) < light.r) return true;
  }
  return false;
}

function circleHitsWalls(x, y, radius) {
  if (x - radius < FIELD.x || x + radius > FIELD.x + FIELD.width) return true;
  if (y - radius < FIELD.y || y + radius > FIELD.y + FIELD.height) return true;
  for (const wall of WALLS) {
    const nearestX = clamp(x, wall.x, wall.x + wall.width);
    const nearestY = clamp(y, wall.y, wall.y + wall.height);
    if (distance(x, y, nearestX, nearestY) < radius) return true;
  }
  for (const statue of STATUES) {
    const nearestX = clamp(x, statue.x, statue.x + statue.w);
    const nearestY = clamp(y, statue.y, statue.y + statue.h);
    if (distance(x, y, nearestX, nearestY) < radius) return true;
  }
  return false;
}

/** Move a circle with axis separation so it slides along walls. */
function moveCircle(body, dx, dy, radius) {
  const nx = body.x + dx;
  if (!circleHitsWalls(nx, body.y, radius)) body.x = nx;
  const ny = body.y + dy;
  if (!circleHitsWalls(body.x, ny, radius)) body.y = ny;
}

export function createWorld() {
  const state = freshState();
  return { state, reset, step };

  function freshState() {
    return {
      time: 0,
      player: { x: PLAYER.start.x, y: PLAYER.start.y },
      moving: false,
      sneaking: false,
      playerInLight: false,
      exposure: 0,
      lootTaken: false,
      score: 0,
      won: false,
      caught: false,
      guard: {
        x: GUARD_START.x, y: GUARD_START.y, angle: 0,
        waypoint: 0, suspicion: 0, stage: STAGE_CALM,
        lastSeen: null, unseenFor: 0, pausedFor: 0,
      },
      cctv: { angle: CCTV.sweepCentre, direction: 1 },
      cctvSeesPlayer: false,
      guardSeesPlayer: false,
    };
  }

  function reset() {
    const next = freshState();
    Object.assign(state, next);
  }

  /**
   * Advance one fixed step. `input` is {x, y, sneak} (unit-ish direction).
   * Returns an event bitmask: EVENT_LOOT, EVENT_WIN, EVENT_CAUGHT,
   * EVENT_ALARM (exposure hit 100) and EVENT_CHASE (guard just went to CHASE).
   */
  function step(dt, input) {
    if (state.won || state.caught) return 0;
    let events = 0;
    state.time += dt;
    const player = state.player;
    const guard = state.guard;

    // --- player movement: fast in shadow, slow in light, silent-slow on Shift
    state.playerInLight = inLight(player.x, player.y);
    state.sneaking = Boolean(input.sneak);
    const speed = state.sneaking
      ? PLAYER.speedSneak
      : state.playerInLight ? PLAYER.speedLight : PLAYER.speedShadow;
    const length = Math.hypot(input.x, input.y);
    state.moving = length > 0;
    if (length > 0) {
      moveCircle(player, (input.x / length) * speed * dt, (input.y / length) * speed * dt, PLAYER.radius);
      state.playerInLight = inLight(player.x, player.y);
    }

    // --- exposure meter: light fills it, shadow drains it, CCTV fills it fast
    if (state.playerInLight) {
      if (!state.sneaking) {
        state.exposure += (state.moving ? EXPOSURE.lightMoving : EXPOSURE.lightStanding) * dt;
      }
    } else {
      state.exposure -= EXPOSURE.shadowDrain * dt;
    }
    if (state.cctvSeesPlayer) state.exposure += EXPOSURE.cctvSeen * dt;
    state.exposure = clamp(state.exposure, 0, 100);
    if (state.exposure >= EXPOSURE.alarmAt) {
      state.exposure = EXPOSURE.alarmReset;
      guard.suspicion = 100;
      guard.lastSeen = { x: player.x, y: player.y };
      events |= EVENT_ALARM;
    }

    // --- CCTV sweep: a rotating red cone; being seen feeds exposure
    state.cctv.angle += CCTV.sweepSpeed * state.cctv.direction * dt;
    if (state.cctv.angle > CCTV.sweepCentre + CCTV.sweepWidth) state.cctv.direction = -1;
    if (state.cctv.angle < CCTV.sweepCentre - CCTV.sweepWidth) state.cctv.direction = 1;
    state.cctvSeesPlayer = seesInCone(
      CCTV.x, CCTV.y, state.cctv.angle, CCTV.halfAngle, CCTV.range, player,
    );

    // --- guard vision: cone + range + line of sight (statues block it)
    state.guardSeesPlayer = seesInCone(
      guard.x, guard.y, guard.angle, GUARD.visionHalfAngle, GUARD.visionRange, player,
    );
    if (state.guardSeesPlayer) {
      const dist = distance(guard.x, guard.y, player.x, player.y);
      const closeness = 1 - (dist / GUARD.visionRange) * 0.5;
      guard.suspicion += GUARD.suspicionGain * closeness * dt;
      guard.lastSeen = { x: player.x, y: player.y };
      guard.unseenFor = 0;
    } else {
      guard.unseenFor += dt;
      guard.suspicion -= (guard.suspicion < GUARD.suspicionCalm ? 22 : 9) * dt;
    }
    guard.suspicion = clamp(guard.suspicion, 0, 100);
    const nextStage = guard.suspicion >= GUARD.suspicionChase
      ? STAGE_CHASE
      : guard.suspicion >= GUARD.suspicionCalm ? STAGE_SUSPICIOUS : STAGE_CALM;
    if (nextStage === STAGE_CHASE && guard.stage !== STAGE_CHASE) events |= EVENT_CHASE;
    guard.stage = nextStage;

    // --- guard behaviour per stage
    if (guard.stage === STAGE_CALM) {
      patrol(dt);
    } else if (guard.stage === STAGE_SUSPICIOUS) {
      // Stop, turn toward the last thing seen, and stare.
      if (guard.lastSeen) {
        guard.angle = Math.atan2(guard.lastSeen.y - guard.y, guard.lastSeen.x - guard.x);
      }
      guard.pausedFor += dt;
    } else {
      // CHASE: run at the player (or the last place seen).
      const target = state.guardSeesPlayer ? player : guard.lastSeen;
      if (target) {
        const angle = Math.atan2(target.y - guard.y, target.x - guard.x);
        guard.angle = angle;
        moveCircle(guard, Math.cos(angle) * GUARD.speedChase * dt, Math.sin(angle) * GUARD.speedChase * dt, 14);
      }
      if (guard.unseenFor > GUARD.loseSightSeconds) {
        guard.suspicion = GUARD.suspicionCalm - 1; // drops back to SUSPICIOUS, then CALM
        guard.lastSeen = null;
      }
    }

    // --- caught?
    if (distance(guard.x, guard.y, player.x, player.y) < GUARD.catchDistance + PLAYER.radius - 3) {
      state.caught = true;
      return events | EVENT_CAUGHT;
    }

    // --- loot: the Star Chart under the bright lamp
    if (!state.lootTaken && distance(player.x, player.y, LOOT.x, LOOT.y) < LOOT.r + PLAYER.radius + 4) {
      state.lootTaken = true;
      state.score += 500;
      events |= EVENT_LOOT;
    }

    // --- exit: the green door in Vault East
    if (pointInRect(player.x, player.y, EXIT)) {
      state.won = true;
      state.score += state.lootTaken ? Math.max(0, 600 - Math.floor(state.time) * 5) : 250;
      return events | EVENT_WIN;
    }
    return events;
  }

  function patrol(dt) {
    const guard = state.guard;
    const target = GUARD_WAYPOINTS[guard.waypoint];
    const dx = target.x - guard.x;
    const dy = target.y - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 6) {
      guard.waypoint = (guard.waypoint + 1) % GUARD_WAYPOINTS.length;
      return;
    }
    guard.angle = Math.atan2(dy, dx);
    moveCircle(guard, (dx / dist) * GUARD.speedPatrol * dt, (dy / dist) * GUARD.speedPatrol * dt, 14);
  }

  function seesInCone(ox, oy, angle, halfAngle, range, target) {
    const dist = distance(ox, oy, target.x, target.y);
    if (dist > range) return false;
    let delta = Math.atan2(target.y - oy, target.x - ox) - angle;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    if (Math.abs(delta) > halfAngle) return false;
    return lineOfSight(ox, oy, target.x, target.y);
  }
}

export { CANVAS_WIDTH, CANVAS_HEIGHT, FIELD, STEP };
