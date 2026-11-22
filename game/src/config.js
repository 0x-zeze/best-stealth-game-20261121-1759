// UMBRA HEIST — museum floor plan and tuning numbers. One file, one job:
// every size, speed and rate the world and the renderer share.
export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;
export const HUD_HEIGHT = 64;
export const STEP = 1 / 60;

// Play field (below the HUD bar).
export const FIELD = { x: 24, y: 88, width: 1232, height: 612 };

// Room divider walls (vertical, with a door gap each).
export const WALLS = [
  { x: 440, y: FIELD.y, width: 10, height: 242 }, // west divider, above the door
  { x: 440, y: 430, width: 10, height: 270 }, // west divider, below the door
  { x: 840, y: FIELD.y, width: 10, height: 242 },
  { x: 840, y: 430, width: 10, height: 270 },
];
// Door gaps in the divider walls: y 330..430 is open.
export const DOORS = [
  { x: 440, y: 330, width: 10, height: 100 },
  { x: 840, y: 330, width: 10, height: 100 },
];

// Room names by x band, for the HUD.
export const ROOMS = [
  { name: 'GALLERY WEST', x0: FIELD.x, x1: 440 },
  { name: 'STAR CHART HALL', x0: 450, x1: 840 },
  { name: 'VAULT EAST', x0: 850, x1: FIELD.x + FIELD.width },
];

// Warm light pools: standing inside one fills the exposure meter.
export const LIGHTS = [
  { x: 180, y: 200, r: 115 },
  { x: 640, y: 250, r: 135 }, // the bright lamp over the Star Chart
  { x: 1080, y: 200, r: 115 },
  { x: 300, y: 580, r: 85 },
  { x: 640, y: 580, r: 90 },
  { x: 1000, y: 580, r: 85 },
];

// Statue pedestals: cover that blocks a guard's line of sight.
export const STATUES = [
  { x: 560, y: 470, w: 58, h: 58, label: 'MARBLE FOX' },
  { x: 980, y: 300, w: 58, h: 58, label: 'BRONZE OWL' },
];

// The loot and the exit.
export const LOOT = { x: 640, y: 250, r: 16 };
export const EXIT = { x: 1208, y: 500, w: 48, h: 84 };

// Guard patrol (Star Chart Hall) and CCTV (Vault East).
export const GUARD_START = { x: 640, y: 200 };
export const GUARD_WAYPOINTS = [
  { x: 500, y: 200 },
  { x: 780, y: 200 },
  { x: 780, y: 560 },
  { x: 500, y: 560 },
];
export const GUARD = {
  speedPatrol: 88,
  speedChase: 205,
  visionRange: 235,
  visionHalfAngle: 0.56, // ~32 degrees each side
  catchDistance: 24,
  suspicionGain: 64, // per second while the player is seen
  suspicionCalm: 40, // below this: CALM (patrol)
  suspicionChase: 80, // at/above this: CHASE (!)
  loseSightSeconds: 3,
};
export const CCTV = {
  x: 1100, y: 112, range: 245, halfAngle: 0.49,
  sweepCentre: Math.PI / 2, sweepWidth: 1.1, sweepSpeed: 0.55,
};

// The player: fast only in shadow, slow in light, silent-slow on Shift.
export const PLAYER = {
  radius: 13,
  speedShadow: 175,
  speedLight: 95,
  speedSneak: 68,
  start: { x: 95, y: 620 },
};

// Exposure meter 0..100: light fills it, shadow drains it, CCTV fills it fast.
export const EXPOSURE = {
  lightMoving: 28,
  lightStanding: 15,
  shadowDrain: 20,
  cctvSeen: 48,
  alarmAt: 100,
  alarmReset: 55,
};

export const BEST_KEY = 'umbra-heist-best';
