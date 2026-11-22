// UMBRA HEIST — keyboard input: WASD/arrows to move, Shift to sneak, Space/Enter
// to confirm, P or Escape to pause, R to restart after a win or a capture.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;

export function createInput() {
  const keys = new Set();
  let actions = 0;

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    keys.add(event.key.length === 1 ? event.key.toLowerCase() : event.key);
    if (event.key === ' ' || event.key === 'Enter') actions |= ACTION_CONFIRM;
    if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') actions |= ACTION_PAUSE;
    if (event.key === 'r' || event.key === 'R') actions |= ACTION_RESTART;
  }

  function onKeyUp(event) {
    keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  return {
    /** Current movement direction plus sneak, read every frame. */
    direction() {
      const left = keys.has('a') || keys.has('A') || keys.has('ArrowLeft');
      const right = keys.has('d') || keys.has('D') || keys.has('ArrowRight');
      const up = keys.has('w') || keys.has('W') || keys.has('ArrowUp');
      const down = keys.has('s') || keys.has('S') || keys.has('ArrowDown');
      return {
        x: (right ? 1 : 0) - (left ? 1 : 0),
        y: (down ? 1 : 0) - (up ? 1 : 0),
        sneak: keys.has('Shift'),
      };
    },
    /** Actions pressed since the last read (confirm / pause / restart). */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
