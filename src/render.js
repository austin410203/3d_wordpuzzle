// render.js — low-res pixel pipeline: ortho camera snapped to the texel grid, depth+normal
// outlines, dithered darkness/vignette, then a nearest upscale with sub-pixel smoothing.
import * as THREE from 'three';

export const PPU = 16;              // pixels per world unit
export const PITCH = THREE.MathUtils.degToRad(52);

export class PixelRenderer {
  constructor(canvas) {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    r.setPixelRatio(1);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.BasicShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.5, 220);
    this.camera.layers.enable(3);
    this.dir = new THREE.Vector3(0, -Math.sin(PITCH), -Math.cos(PITCH));
    this.up = new THREE.Vector3(0, Math.cos(PITCH), -Math.sin(PITCH));
    this.right = new THREE.Vector3(1, 0, 0);
    this.zoom = 1;
    this.offset = new THREE.Vector2();
    this.normalMat = new THREE.MeshNormalMaterial();
    this.silMat = new THREE.MeshBasicMaterial({ color: 0x2a2440, depthFunc: THREE.GreaterDepth, depthWrite: false, transparent: true, opacity: 0.55 });
    this.uniforms = {
      tColor: { value: null }, tDepth: { value: null }, tNormal: { value: null },
      texel: { value: new THREE.Vector2() }, depthRange: { value: 1 },
      uDark: { value: 0 }, uLight: { value: new THREE.Vector2(0.5, 0.5) }, uLightR: { value: 0.3 }, aspect: { value: 1 },
      uTint: { value: new THREE.Color(1, 1, 1) }, uOutline: { value: 1 }, uFlash: { value: 0 },
    };
    this.comp = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
      fragmentShader: `
        uniform sampler2D tColor, tDepth, tNormal; uniform vec2 texel; uniform float depthRange;
        uniform float uDark, uLightR, aspect, uOutline, uFlash; uniform vec2 uLight; uniform vec3 uTint;
        varying vec2 vUv;
        float D(vec2 uv){ return texture2D(tDepth, uv).r * depthRange; }
        vec3 N(vec2 uv){ return texture2D(tNormal, uv).rgb * 2.0 - 1.0; }
        float bayer4(vec2 p){ ivec2 q = ivec2(mod(p, 4.0)); int i = q.x + q.y*4;
          float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.); return (m[i]+0.5)/16.; }
        float nEdge(vec3 n, vec3 nn, float dd){
          float nd = dot(n - nn, vec3(1.0, 1.0, 1.0));
          float ni = clamp(smoothstep(-0.01, 0.01, nd), 0.0, 1.0);
          float di = clamp(sign(dd * 0.25 + 0.0025), 0.0, 1.0);
          return (1.0 - dot(n, nn)) * di * ni;
        }
        void main(){
          vec4 col = texture2D(tColor, vUv);
          float dc = D(vUv);
          vec2 o[4]; o[0] = vec2(texel.x, 0.); o[1] = vec2(-texel.x, 0.); o[2] = vec2(0., texel.y); o[3] = vec2(0., -texel.y);
          float diff = 0.0; float ne = 0.0; vec3 nc = N(vUv);
          for (int i = 0; i < 4; i++) {
            float dn = D(vUv + o[i]);
            diff = max(diff, dn - dc);
            ne += nEdge(nc, N(vUv + o[i]), dn - dc);
          }
          float thr = 0.32 + dc * 0.0;
          float edge = step(thr, diff) * uOutline;
          vec3 c = col.rgb;
          float lum = dot(c, vec3(0.299, 0.587, 0.114));
          c = mix(vec3(lum), c, 1.12);                    // a bit more saturation
          c *= uTint;
          if (edge > 0.5) c = c * vec3(0.40, 0.33, 0.36);
          else if (ne > 0.18 && dc < depthRange * 0.99) c = c * 1.22 + 0.015;
          if (uDark > 0.0) {
            vec2 d = (vUv - uLight); d.x *= aspect;
            float r = length(d) / uLightR;
            float lit = 1.0 - smoothstep(0.55, 1.0, r);
            lit = floor(lit * 4.0 + bayer4(gl_FragCoord.xy)) / 4.0;
            c *= mix(1.0, mix(0.035, 1.0, lit), uDark);
          }
          c = mix(c, vec3(1.0, 0.98, 0.92), uFlash);
          gl_FragColor = vec4(c, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.blit = new THREE.ShaderMaterial({
      uniforms: { tex: { value: null }, size: { value: new THREE.Vector2() }, ps: { value: 1 }, off: { value: new THREE.Vector2() } },
      vertexShader: `void main(){ gl_Position = vec4(position.xy, 0., 1.); }`,
      fragmentShader: `uniform sampler2D tex; uniform vec2 size; uniform float ps; uniform vec2 off;
        void main(){ vec2 p = gl_FragCoord.xy / ps + 1.0 + off; gl_FragColor = texture2D(tex, p / size);
          #include <colorspace_fragment>
        }`,
      depthTest: false, depthWrite: false,
    });
    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.comp);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
    this.target = new THREE.Vector3();
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.ps = Math.max(1, Math.round(h / 330));
    if (w < 700) this.ps = Math.max(1, Math.round(h / 300));
    this.W = Math.ceil(w / this.ps); this.H = Math.ceil(h / this.ps);
    const RW = this.W + 2, RH = this.H + 2;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + 'px'; this.renderer.domElement.style.height = h + 'px';
    const mk = (type, depth) => {
      const t = new THREE.WebGLRenderTarget(RW, RH, { type, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
      if (depth) { t.depthTexture = new THREE.DepthTexture(RW, RH); t.depthTexture.type = THREE.UnsignedIntType; }
      return t;
    };
    for (const k of ['rtColor', 'rtNormal', 'rtComp']) this[k]?.dispose();
    this.rtColor = mk(THREE.HalfFloatType, true);
    this.rtNormal = mk(THREE.UnsignedByteType, false);
    this.rtComp = mk(THREE.HalfFloatType, false);
    this.uniforms.tColor.value = this.rtColor.texture;
    this.uniforms.tDepth.value = this.rtColor.depthTexture;
    this.uniforms.tNormal.value = this.rtNormal.texture;
    this.uniforms.texel.value.set(1 / RW, 1 / RH);
    this.uniforms.aspect.value = RW / RH;
    this.blit.uniforms.tex.value = this.rtComp.texture;
    this.blit.uniforms.size.value.set(RW, RH);
    this.blit.uniforms.ps.value = this.ps;
    this.updateFrustum();
  }

  updateFrustum() {
    const c = this.camera, z = this.zoom;
    const hw = (this.W + 2) / 2 / PPU / z, hh = (this.H + 2) / 2 / PPU / z;
    c.left = -hw; c.right = hw; c.top = hh; c.bottom = -hh;
    c.updateProjectionMatrix();
    this.uniforms.depthRange.value = c.far - c.near;
  }

  // view extents on the ground plane (approx), for camera clamping
  viewHalf() { return { x: this.W / 2 / PPU / this.zoom, z: this.H / 2 / PPU / this.zoom / Math.sin(PITCH) }; }

  setTarget(t) {
    this.target.copy(t);
    const P = t.clone().addScaledVector(this.dir, -100);
    const texel = 1 / PPU / this.zoom;
    const pr = P.dot(this.right), pu = P.dot(this.up);
    const sr = Math.round(pr / texel) * texel, su = Math.round(pu / texel) * texel;
    P.addScaledVector(this.right, sr - pr).addScaledVector(this.up, su - pu);
    this.camera.position.copy(P);
    this.camera.lookAt(P.clone().add(this.dir));
    this.camera.updateMatrixWorld();
    this.offset.set((pr - sr) / texel, (pu - su) / texel);
    this.blit.uniforms.off.value.copy(this.offset);
  }

  // project world point to composite uv (0..1)
  toUV(p) {
    const v = p.clone().project(this.camera);
    return new THREE.Vector2(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5);
  }

  render(scene, silhouetteLayer = 1) {
    const r = this.renderer, cam = this.camera;
    const bg = scene.background;
    // 1. world colour + depth (characters excluded)
    cam.layers.set(0); cam.layers.enable(3);
    r.setRenderTarget(this.rtColor); r.clear(); r.render(scene, cam);
    // 2. silhouette of characters where the world hides them, 3. characters on top
    r.autoClear = false;
    cam.layers.set(silhouetteLayer);
    scene.overrideMaterial = this.silMat; scene.background = null;
    r.render(scene, cam);
    scene.overrideMaterial = null;
    r.render(scene, cam);
    // 3. normals (no FX layer)
    cam.layers.set(0); cam.layers.enable(1);
    scene.overrideMaterial = this.normalMat;
    r.setRenderTarget(this.rtNormal); r.setClearColor(0x8080ff, 1); r.clear(); r.render(scene, cam);
    scene.overrideMaterial = null; scene.background = bg;
    r.setClearColor(this.clearColor ?? 0x1c2414, 1);
    r.autoClear = true;
    // 4. composite → 5. upscale blit
    this.quad.material = this.comp;
    r.setRenderTarget(this.rtComp); r.render(this.quadScene, this.quadCam);
    this.quad.material = this.blit;
    r.setRenderTarget(null); r.render(this.quadScene, this.quadCam);
  }
}
