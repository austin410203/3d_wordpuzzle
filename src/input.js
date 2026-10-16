// input.js — keyboard + touch joystick
export class Input {
  constructor() {
    this.keys = new Set(); this.pressed = new Set();
    this.joy = { x: 0, y: 0, active: false };
    addEventListener('keydown', e => {
      if (e.repeat) { if (!['Tab'].includes(e.code)) return; }
      const k = e.code;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    this.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || location.search.includes('touch');
  }
  bindTouch(stick, knob, btnA, btnB, btnM) {
    let id = null, cx = 0, cy = 0;
    const R = 34;
    stick.addEventListener('pointerdown', e => { id = e.pointerId; const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; stick.setPointerCapture(id); move(e); });
    const move = e => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - cx, dy = e.clientY - cy; const L = Math.hypot(dx, dy);
      if (L > R) { dx *= R / L; dy *= R / L; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joy.x = dx / R; this.joy.y = dy / R; this.joy.active = true;
    };
    stick.addEventListener('pointermove', move);
    const end = e => { if (e.pointerId !== id) return; id = null; knob.style.transform = ''; this.joy.x = this.joy.y = 0; this.joy.active = false; };
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
    const tap = (el, code) => {
      el.addEventListener('pointerdown', e => { e.preventDefault(); this.pressed.add(code); this.keys.add(code); });
      el.addEventListener('pointerup', () => this.keys.delete(code));
      el.addEventListener('pointerleave', () => this.keys.delete(code));
    };
    tap(btnA, 'KeyE'); tap(btnB, 'ShiftLeft'); tap(btnM, 'Tab');
  }
  down(...codes) { return codes.some(c => this.keys.has(c)); }
  hit(...codes) { return codes.some(c => this.pressed.has(c)); }
  axis() {
    let x = 0, z = 0;
    if (this.down('KeyA', 'ArrowLeft')) x -= 1;
    if (this.down('KeyD', 'ArrowRight')) x += 1;
    if (this.down('KeyW', 'ArrowUp')) z -= 1;
    if (this.down('KeyS', 'ArrowDown')) z += 1;
    if (this.joy.active) { x = this.joy.x; z = this.joy.y; }
    const L = Math.hypot(x, z);
    if (L > 1) { x /= L; z /= L; }
    return { x, z, mag: Math.min(1, L) };
  }
  endFrame() { this.pressed.clear(); }
}
