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
  // Floating joystick: touch anywhere in the left zone, the stick appears under the finger.
  // Uses Touch Events when available (most reliable on iOS/Android), pointer events otherwise.
  bindTouch(zone, stick, knob, btnA, btnB, btnM, btnBag) {
    const R = 40;
    let sid = null, cx = 0, cy = 0;
    const held = new Map(); // touch/pointer id -> key code
    // fixed joystick: always centred on the drawn ring, wherever inside the grab zone the touch starts
    const place = () => {
      const r = stick.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      stick.classList.add('on');
    };
    const steer = (x, y) => {
      let dx = x - cx, dy = y - cy; const L = Math.hypot(dx, dy);
      if (L > R) { dx *= R / L; dy *= R / L; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const m = Math.hypot(dx, dy) / R;
      this.joy.x = m < 0.12 ? 0 : dx / R; this.joy.y = m < 0.12 ? 0 : dy / R; this.joy.active = true;
    };
    const release = () => {
      sid = null; knob.style.transform = ''; this.joy.x = this.joy.y = 0; this.joy.active = false;
      stick.classList.remove('on');
    };
    const press = (id, code, el) => { held.set(id, code); this.pressed.add(code); this.keys.add(code); el.classList.add('down'); };
    const unpress = (id) => {
      const code = held.get(id); if (!code) return; held.delete(id);
      if (![...held.values()].includes(code)) this.keys.delete(code);
      for (const el of [btnA, btnB, btnM, btnBag]) if (el.dataset.code === code) el.classList.remove('down');
    };
    btnA.dataset.code = 'KeyE'; btnB.dataset.code = 'ShiftLeft'; btnM.dataset.code = 'KeyM'; btnBag.dataset.code = 'KeyB';
    const opt = { passive: false };
    if ('ontouchstart' in window || location.search.includes('touchev')) {
      zone.addEventListener('touchstart', e => {
        e.preventDefault();
        for (const t of e.changedTouches) if (sid === null) { sid = t.identifier; place(t.clientX, t.clientY); steer(t.clientX, t.clientY); }
      }, opt);
      const tmove = e => { for (const t of e.changedTouches) if (t.identifier === sid) { e.preventDefault(); steer(t.clientX, t.clientY); } };
      const tend = e => { for (const t of e.changedTouches) { if (t.identifier === sid) release(); unpress(t.identifier); } };
      addEventListener('touchmove', tmove, opt);
      addEventListener('touchend', tend); addEventListener('touchcancel', tend);
      for (const el of [btnA, btnB, btnM, btnBag]) el.addEventListener('touchstart', e => {
        e.preventDefault(); e.stopPropagation();
        for (const t of e.changedTouches) press(t.identifier, el.dataset.code, el);
      }, opt);
      // safety net: when no finger is on the screen nothing may stay held
      addEventListener('touchend', e => { if (e.touches.length === 0) { release(); for (const id of [...held.keys()]) unpress(id); } });
    } else {
      zone.addEventListener('pointerdown', e => { if (sid !== null) return; sid = e.pointerId; zone.setPointerCapture(sid); place(e.clientX, e.clientY); steer(e.clientX, e.clientY); });
      zone.addEventListener('pointermove', e => { if (e.pointerId === sid) steer(e.clientX, e.clientY); });
      const pend = e => { if (e.pointerId === sid) release(); };
      zone.addEventListener('pointerup', pend); zone.addEventListener('pointercancel', pend); zone.addEventListener('lostpointercapture', pend);
      for (const el of [btnA, btnB, btnM, btnBag]) {
        el.addEventListener('pointerdown', e => { e.preventDefault(); press('p' + e.pointerId, el.dataset.code, el); });
        for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, e => unpress('p' + e.pointerId));
      }
    }
    addEventListener('blur', () => { release(); for (const id of [...held.keys()]) unpress(id); });
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
