// main.js — bootstrap
import * as THREE from 'three';
import { PixelRenderer } from './render.js';
import { makeGradient } from './terrain.js';
import { initMaterials } from './props.js';
import { initCharacters } from './characters.js';
import { buildWorld } from './world.js';
import { Input } from './input.js';
import { Game } from './game.js';

const $ = (id) => document.getElementById(id);
const tick = () => new Promise(r => setTimeout(r, 0));

async function boot() {
  const pr = new PixelRenderer($('c'));
  const scene = new THREE.Scene();
  const gradient = makeGradient([95, 175, 255]);
  initMaterials(gradient); initCharacters(gradient);
  const U = { uTime: { value: 0 }, uCloud: { value: 1 } };

  // lights
  const sun = new THREE.DirectionalLight(0xfff0d4, 2.7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -36; sc.right = 36; sc.top = 36; sc.bottom = -36; sc.near = 1; sc.far = 180;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  const amb = new THREE.HemisphereLight(0xc8d0ff, 0x7a6a4a, 1.25);
  scene.add(amb);
  sun.layers.enableAll(); amb.layers.enableAll();
  pr.renderer.shadowMap.autoUpdate = false;

  $('tload-n').textContent = '';
  await tick();
  const world = buildWorld(scene, gradient, U);
  $('tload').textContent = '準備好了';
  const input = new Input();
  const game = new Game({ pr, scene, world, input, U, sun, amb, $ });
  window.__game = game;

  const SUN_DIR = new THREE.Vector3(-0.55, 1, 0.42).normalize();
  let last = performance.now();
  const frame = (dt) => {
    U.uTime.value += dt;
    game.update(dt);
    // shadow camera follows the view, snapped to shadow texels
    const t = pr.target;
    const texel = 72 / 2048;
    const lp = t.clone().addScaledVector(SUN_DIR, 80);
    const m = new THREE.Matrix4().lookAt(lp, t, new THREE.Vector3(0, 1, 0));
    const inv = m.clone().invert();
    const ls = t.clone().applyMatrix4(inv);
    ls.x = Math.round(ls.x / texel) * texel; ls.y = Math.round(ls.y / texel) * texel;
    const snapped = ls.applyMatrix4(m);
    sun.target.position.copy(snapped);
    sun.position.copy(snapped).addScaledVector(SUN_DIR, 80);
    sun.target.updateMatrixWorld();
    pr.renderer.shadowMap.needsUpdate = true;
    pr.render(scene);
    input.endFrame();
  };
  game.frame = frame;
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    frame(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  addEventListener('resize', () => pr.resize());
  game.showTitle();
}
boot().catch(e => { console.error(e); document.getElementById('tload').textContent = '載入失敗:' + e.message; });
