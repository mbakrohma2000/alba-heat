// input.js — keyboard and pointer state for the game. One job: track which
// keys are held, which were pressed this frame, and how far the mouse has
// been dragged, so player.js and main.js never touch raw DOM events.

export function createInput(target) {
  const held = new Set();
  const pressed = new Set();
  const drag = { active: false, dx: 0, dy: 0, lastX: 0, lastY: 0 };
  const GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

  window.addEventListener('keydown', (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    held.add(e.code);
  });
  window.addEventListener('keyup', (e) => { held.delete(e.code); });
  window.addEventListener('blur', () => { held.clear(); pressed.clear(); });

  target.addEventListener('pointerdown', (e) => {
    drag.active = true; drag.lastX = e.clientX; drag.lastY = e.clientY;
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag.active) return;
    drag.dx += e.clientX - drag.lastX;
    drag.dy += e.clientY - drag.lastY;
    drag.lastX = e.clientX; drag.lastY = e.clientY;
  });
  window.addEventListener('pointerup', () => { drag.active = false; });

  return {
    down(...codes) { return codes.some((c) => held.has(c)); },
    hit(...codes) { return codes.some((c) => pressed.has(c)); },
    axis() {
      // WASD / arrows as a -1..1 pair: x = strafe right, y = forward.
      const x = (this.down('KeyD', 'ArrowRight') ? 1 : 0) - (this.down('KeyA', 'ArrowLeft') ? 1 : 0);
      const y = (this.down('KeyW', 'ArrowUp') ? 1 : 0) - (this.down('KeyS', 'ArrowDown') ? 1 : 0);
      return { x, y };
    },
    takeDrag() {
      const d = { dx: drag.dx, dy: drag.dy };
      drag.dx = 0; drag.dy = 0;
      return d;
    },
    endFrame() { pressed.clear(); },
  };
}
