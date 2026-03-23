import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { openModal } from '../store/hudStore';

const isMobile = () =>
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768;

const isLowEnd = () => {
  if (!isMobile()) return false;
  const gl = document.createElement('canvas').getContext('webgl');
  if (!gl) return true;
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  if (!dbg) return true;
  const renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) as string;
  const lowEndGPUs = /mali-g5|mali-g7|mali-4|mali-t|adreno (3|4|5[012])|powervr/i;
  return lowEndGPUs.test(renderer);
};

const V = `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;

export const CorridorShader = {
  uniforms: {
    tDiffuse:   { value: null },
    time:       { value: 0.0 },
    progress:   { value: 0.0 },
    resolution: { value: new THREE.Vector2(1, 1) },
    mobile:     { value: 0.0 },
    lowEnd:     { value: 0.0 },
    mouse:      { value: new THREE.Vector2(0.0, 0.0) },
  },
  vertexShader: V,
  fragmentShader: `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float time, progress, mobile, lowEnd;
    uniform vec2 resolution;
    uniform vec2 mouse;
    varying vec2 vUv;

    float hash(float t){return fract(sin(t*788.874));}
    float curve(float t,float d){t/=d;return mix(hash(floor(t)),hash(floor(t)+1.0),pow(smoothstep(0.0,1.0,fract(t)),10.0));}

    float hash2(vec2 uv){
      vec2 s = sin(uv * 127.1 + uv.yx * 311.7);
      return fract(dot(s, vec2(43758.5, 38714.3)));
    }
    vec2 hash22(vec2 uv){
      vec2 s = sin(uv * 127.1 + uv.yx * 311.7);
      return fract(s * vec2(43758.5, 38714.3));
    }
    vec3 hash3(vec2 id){
      vec3 s = sin(id.xyy * vec3(127.1, 311.7, 74.7) + id.yxx * vec3(269.5, 183.3, 246.1));
      return fract(s * 43758.5);
    }

    float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
    vec3 toGamma(vec3 c){ return sqrt(max(c, vec3(0.0))); }

    vec3 corridorLowEnd(vec2 uv, float t){
      vec3 size = vec3(0.9, 0.9, 1000.0);
      vec3 col = vec3(0.0);
      float ct = t * 5.5;
      vec3 s = vec3(0.0, 0.0, -1.0);
      vec3 r = normalize(vec3(-uv, 2.0));
      vec3 boxmin = (size - s) / r;
      vec3 boxmax = (-size - s) / r;
      vec3 box = max(boxmin, boxmax);
      float d = min(box.x, box.y);
      vec3 p = s + r * d;
      vec2 cuv = p.xz;
      if(box.x < box.y){ cuv = p.yz; cuv.x += 1.0; }
      vec3 p2 = p;
      p2.z += ct * 3.0;
      cuv.y += ct * 3.0;
      cuv *= 3.0;
      vec2 id = floor(cuv);
      float brightness = curve(t + id.y * 0.01 + id.x * 0.03, 0.3);
      vec3 addcol = vec3(brightness * 2.0);
      addcol *= smoothstep(brightness * 0.5, 0.0, hash2(id));
      addcol *= smoothstep(0.4, 0.6, sin(p2.x) * sin(p2.z * 0.4) + 0.5);
      col += addcol;
      col = clamp(col * 1.1, 0.0, 1.0);
      col = smoothstep(0.0, 0.85, col);
      col = pow(col, vec3(0.4545));
      return col;
    }

    vec3 corridor(vec2 uv, float t){
      float STEPS = mobile > 0.5 ? 2.0 : 4.0;
      vec3 size = vec3(0.9, 0.9, 1000.0);
      vec3 col = vec3(0.0);
      float ct = t * 5.5;
      for(float j = 0.0; j < 4.0; ++j){
        float contrib = step(j + 0.5, STEPS);
        vec2 off = hash22(uv + j * 74.542 + 35.877) * 2.0 - 1.0;
        float t2 = ct + j * 0.05 / STEPS;
        vec3 s = vec3(0.0, 0.0, -1.0);
        s.xy += off * 0.02;
        vec3 r = normalize(vec3(-uv - off * 0.004, 2.0));
        vec3 alpha = vec3(1.0);
        for(float i = 0.0; i < 2.0; ++i){
          vec3 boxmin = (size - s) / r;
          vec3 boxmax = (-size - s) / r;
          vec3 box = max(boxmin, boxmax);
          float d = min(box.x, box.y);
          vec3 p = s + r * d;
          float depthFade = exp(-abs(p.z) * 0.015);
          vec2 cuv = p.xz;
          vec3 n = vec3(0.0, sign(box.y), 0.0);
          if(box.x < box.y){ cuv = p.yz; cuv.x += 1.0; n = vec3(sign(box.x), 0.0, 0.0); }
          vec3 p2 = p;
          p2.z += t2 * 3.0;
          cuv.y += t2 * 3.0;
          cuv *= 3.0;
          vec2 id = floor(cuv);
          float rough = min(1.0, 0.90 + 0.1 * hash2(id + 100.5));
          float brightness = curve(t + id.y * 0.01 + id.x * 0.03, 0.3);
          vec3 addcol = vec3(brightness * 2.0);
          addcol *= smoothstep(brightness * 0.5, 0.0, hash2(id));
          addcol *= smoothstep(0.4, 0.6, sin(p2.x) * sin(p2.z * 0.4) + 0.5);
          addcol += vec3(1.0) * smoothstep(-0.85, -1.1, p2.y) * max(0.0, curve(t, 0.2) * 2.0 - 1.0) * step(hash2(id + 0.7), 0.2);
          col += addcol * alpha * depthFade * contrib;
          float fre = pow(1.0 - max(0.0, dot(n, r)), 3.0);
          alpha *= mix(vec3(1.0), vec3(fre * 0.9), contrib);
          vec3 pure = reflect(r, n);
          r = normalize(hash3(uv + j * 74.524 + i * 35.712) - 0.5);
          float dr = dot(r, n);
          r = mix(r, -r, step(dr, 0.0));
          r = normalize(mix(r, pure, rough));
          s = p;
        }
      }
      col /= STEPS;
      col *= 1.1;
      col = smoothstep(0.0, 0.85, col);
      col = pow(col, vec3(0.4545));
      return col;
    }

    void main(){
      vec2 uv = vUv;
      vec3 scene = texture2D(tDiffuse, uv).rgb;
      if(progress <= 0.0){ gl_FragColor = vec4(scene, 1.0); return; }
      float blend = smoothstep(0.0, 0.35, progress) * smoothstep(1.0, 0.72, progress);
      blend = clamp(blend, 0.0, 1.0);
      if(blend < 0.01){ gl_FragColor = vec4(scene, 1.0); return; }
      vec2 corrUv = uv - 0.5;
      corrUv /= vec2(resolution.y / resolution.x, 1.0);
      corrUv += mouse * 0.22 * blend;
      vec3 corridorCol = lowEnd > 0.5
        ? corridorLowEnd(corrUv, time)
        : corridor(corrUv, time);
      float vignette = 1.0 - smoothstep(0.3, 1.1, length((uv - 0.5) * vec2(resolution.x / resolution.y, 1.0)));
      corridorCol *= mix(1.0, vignette * vignette, 0.85);
      float sceneGray = luma(scene);
      vec3 sceneFaded = mix(scene, vec3(sceneGray) * 0.18, blend);
      vec3 col = mix(sceneFaded, corridorCol, blend);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
};

export interface CorridorHandle {
  readonly pass: ShaderPass;
  start(): void;
  tick(): void;
  onResize(w: number, h: number): void;
  isActive(): boolean;
  destroy(): void;
}

const CORRIDOR_DURATION = 5000;

export function initCorridorVFX(composer: EffectComposer): CorridorHandle {
  const mobile = isMobile();
  const lowEnd = isLowEnd();

  const pass = new ShaderPass(CorridorShader);
  pass.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
  pass.uniforms.progress.value = 0.0;
  pass.uniforms.mobile.value = mobile ? 1.0 : 0.0;
  pass.uniforms.lowEnd.value = lowEnd ? 1.0 : 0.0;
  composer.addPass(pass);

  const rawMouse    = new THREE.Vector2(0, 0);
  const smoothMouse = new THREE.Vector2(0, 0);

  const onMouseMove = (e: MouseEvent) => {
    rawMouse.x =  (e.clientX / window.innerWidth  - 0.5) * 2.0;
    rawMouse.y = -(e.clientY / window.innerHeight - 0.5) * 2.0;
  };

  const onTouchMove = (e: TouchEvent) => {
    const t = e.touches[0];
    rawMouse.x =  (t.clientX / window.innerWidth  - 0.5) * 2.0;
    rawMouse.y = -(t.clientY / window.innerHeight - 0.5) * 2.0;
  };

  window.addEventListener('mousemove', onMouseMove, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: true });

  let active = false, startTime = 0, uiDispatched = false;

  function start() {
    if (active) return;
    active = true;
    startTime = performance.now();
    uiDispatched = false;
  }

  function tick() {
    smoothMouse.x += (rawMouse.x - smoothMouse.x) * 0.06;
    smoothMouse.y += (rawMouse.y - smoothMouse.y) * 0.06;
    pass.uniforms.mouse.value.copy(smoothMouse);

    if (!active) return;

    const elapsed = performance.now() - startTime;
    const raw = Math.min(elapsed / CORRIDOR_DURATION, 1.0);
    const t = elapsed / 1000.0;

    pass.uniforms.progress.value = raw;
    pass.uniforms.time.value = t;

    if (!uiDispatched && raw >= 0.80) {
      uiDispatched = true;
      openModal();
    }

    if (raw >= 1.0) {
      active = false;
      pass.uniforms.progress.value = 0.0;
      pass.uniforms.time.value = 0.0;
    }
  }

  function onResize(w: number, h: number) {
    pass.uniforms.resolution.value.set(w, h);
  }

  function isActive() { return active; }

  function destroy() {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('touchmove', onTouchMove);
  }

  return { pass, start, tick, onResize, isActive, destroy };
}