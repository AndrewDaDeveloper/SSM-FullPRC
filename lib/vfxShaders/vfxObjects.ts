import * as THREE from 'three';
import { GalleryShader, CenterImageShader } from './postFX';

const IMG_PATHS = [
  '/illustrations/img1.png',
  '/illustrations/img2.png',
  '/illustrations/img3.png',
  '/illustrations/img4.png',
];

const MISSION_TITLES = ['URBAN RECON', 'NIGHT OPS', 'EXTRACTION', 'DEEP COVER'];
const MISSION_TAGS   = ['STEALTH',     'COMBAT',    'RESCUE',     'INTEL'     ];

const N    = IMG_PATHS.length;
const POOL = N * 3;
const CAM_H = 2.2;

const isSmall  = () => window.innerWidth < 480;
const isMobile = () => window.innerWidth < 768;

export const camHalfW   = () => CAM_H * (window.innerWidth / window.innerHeight);
const itemW             = () => isSmall() ? 1.3 : isMobile() ? 1.5 : 1.8;
const itemH             = () => isSmall() ? 0.9 : isMobile() ? 1.05 : 1.25;
const galStep           = () => itemW() + (isSmall() ? 0.15 : 0.2);
export const galStrip   = () => galStep() * N;
const textY             = () => isSmall() ? -0.9 : window.innerHeight > window.innerWidth ? -1.1 : -1.3;
const scrollRange       = () => window.innerHeight > window.innerWidth ? 2.5 : 3.0;
const uiOffsetY         = () => isSmall() ? 1.7 : isMobile() ? 1.5 : 1.4;
const galLabelW         = () => isSmall() ? 2.0 : isMobile() ? 2.4 : 2.8;
const centerImgSize     = () => isSmall() ? 1.4 : isMobile() ? 1.7 : 2.1;

export { scrollRange };

const _imgTexCache: (THREE.Texture | null)[] = Array(N).fill(null);

function tex2d(w: number, h: number, fn: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  fn(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.minFilter = t.magFilter = THREE.LinearFilter;
  return t;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function planeMesh(tex: THREE.Texture, w: number, h: number, x: number, y: number, z: number, opacity = 1) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity }),
  );
  m.position.set(x, y, z);
  return m;
}

const makeLabelTex = () => tex2d(512, 80, ctx => {
  ctx.clearRect(0, 0, 512, 80);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.font = '400 11px "Courier New",monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('E X P L O R E', 256, 6);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${isSmall() ? 26 : 33}px "Courier New",monospace`;
  ctx.shadowColor = 'rgba(255,255,255,0.5)'; ctx.shadowBlur = 18;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('OUR MISSIONS', 256, 72);
});

const makeArrowTex = (dir: 'left' | 'right') => tex2d(128, 128, ctx => {
  ctx.clearRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(255,255,255,0.45)'; ctx.shadowBlur = 10;
  ctx.beginPath();
  if (dir === 'left') { ctx.moveTo(78, 36); ctx.lineTo(44, 64); ctx.lineTo(78, 92); }
  else                { ctx.moveTo(50, 36); ctx.lineTo(84, 64); ctx.lineTo(50, 92); }
  ctx.stroke();
});

const makeDotTex = (active: boolean) => tex2d(64, 64, ctx => {
  ctx.clearRect(0, 0, 64, 64);
  if (active) {
    ctx.shadowColor = 'rgba(255,255,255,0.7)'; ctx.shadowBlur = 8;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.arc(32, 32, 13, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.32)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(32, 32, 12, 0, Math.PI * 2); ctx.stroke();
  }
});

const makeProgressTex = (progress: number) => tex2d(512, 10, ctx => {
  ctx.clearRect(0, 0, 512, 10);
  rr(ctx, 0, 0, 512, 10, 5); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill();
  rr(ctx, 0, 0, Math.max(progress * 512, 10), 10, 5);
  ctx.fillStyle = 'rgba(255,255,255,0.78)'; ctx.fill();
});

const makeCounterTex = (cur: number, total: number) => tex2d(192, 40, ctx => {
  ctx.clearRect(0, 0, 192, 40); ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.font = 'bold 17px "Courier New",monospace'; ctx.textAlign = 'right';
  ctx.fillText(String(cur).padStart(2, '0'), 88, 20);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.font = '400 13px "Courier New",monospace'; ctx.textAlign = 'center';
  ctx.fillText('/', 96, 21);
  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  ctx.font = '400 14px "Courier New",monospace'; ctx.textAlign = 'left';
  ctx.fillText(String(total).padStart(2, '0'), 104, 20);
});

const makeMissionTitleTex = (title: string) => tex2d(512, 56, ctx => {
  ctx.clearRect(0, 0, 512, 56);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = `bold ${isSmall() ? 20 : 24}px "Courier New",monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255,255,255,0.4)'; ctx.shadowBlur = 10;
  ctx.fillText(title, 256, 28);
});

const makeMissionTagTex = (tag: string) => tex2d(256, 36, ctx => {
  ctx.clearRect(0, 0, 256, 36);
  const tw = ctx.measureText(tag).width + 28;
  const tx = (256 - tw) / 2;
  rr(ctx, tx, 4, tw, 28, 14);
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '400 10px "Courier New",monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(tag, 128, 18);
});

const makeStatusTex = (idx: number) => tex2d(256, 28, ctx => {
  ctx.clearRect(0, 0, 256, 28);
  ctx.fillStyle = 'rgba(180,255,180,0.7)';
  ctx.font = '400 10px "Courier New",monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('● ACTIVE', 128, 14);
});

function clearArr(arr: THREE.Mesh[]) {
  arr.forEach(m => { m.parent?.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); });
  arr.length = 0;
}

export interface GalleryState {
  group: THREE.Group | null;
  meshes: THREE.Mesh[];
  offset: number;
  drag: { on: boolean; sx: number; so: number; vx: number; lx: number; lt: number };
  activeIdx: number;
  ui: Record<string, THREE.Mesh>;
  _textures: THREE.Texture[];
}

export function createGalleryState(): GalleryState {
  return {
    group: null, meshes: [], offset: 0,
    drag: { on: false, sx: 0, so: 0, vx: 0, lx: 0, lt: 0 },
    activeIdx: 0, ui: {}, _textures: [],
  };
}

function swapTex(state: GalleryState, m: THREE.Mesh, newTex: THREE.Texture) {
  const mat = m.material as THREE.MeshBasicMaterial;
  const i = state._textures.indexOf(mat.map!);
  if (i !== -1) { state._textures[i].dispose(); state._textures.splice(i, 1); }
  state._textures.push(newTex);
  mat.map = newTex; mat.needsUpdate = true;
}

export function buildGallery(scene: THREE.Scene, state: GalleryState) {
  if (state.group) {
    clearArr(state.meshes);
    state._textures.forEach(t => t.dispose()); state._textures = []; state.ui = {};
    scene.remove(state.group); state.group = null;
  }

  state.group = new THREE.Group();
  scene.add(state.group);
  state.group.position.set(0, textY() - uiOffsetY(), 0.1);

  const iw = itemW(), ih = itemH(), hw = camHalfW();
  const arrowSz   = isSmall() ? 0.22 : 0.27;
  const dotSz     = isSmall() ? 0.09 : 0.11;
  const dotGap    = dotSz * 1.7;
  const totalDotW = (N - 1) * dotGap;
  const progressW = isSmall() ? 1.4 : isMobile() ? 1.8 : 2.2;

  const subY    = -ih / 2;
  const titleY  = subY - 0.14;
  const tagY    = subY - 0.30;
  const statusY = subY - 0.44;
  const dotsY   = subY - 0.60;
  const progY   = subY - 0.74;

  const add = (key: string, m: THREE.Mesh) => {
    state.group!.add(m); state.meshes.push(m); state.ui[key] = m;
  };
  const track = <T extends THREE.Texture>(t: T) => { state._textures.push(t); return t; };

  add('label',    planeMesh(track(makeLabelTex()),        galLabelW(), 0.38, 0,           ih / 2 + 0.26,  0));
  add('counter',  planeMesh(track(makeCounterTex(1, N)),  0.48, 0.10,        hw * 0.72,   ih / 2 + 0.10,  0.05));
  add('arrowL',   planeMesh(track(makeArrowTex('left')),  arrowSz, arrowSz, -(hw * 0.82), 0,              0.05, 0.75));
  add('arrowR',   planeMesh(track(makeArrowTex('right')), arrowSz, arrowSz,  (hw * 0.82), 0,              0.05, 0.75));

  add('missionTitle',  planeMesh(track(makeMissionTitleTex(MISSION_TITLES[0])), iw * 1.05, 0.18, 0, titleY,  0.05));
  add('missionTag',    planeMesh(track(makeMissionTagTex(MISSION_TAGS[0])),     0.75, 0.09,       0, tagY,    0.05));
  add('missionStatus', planeMesh(track(makeStatusTex(0)),                       0.50, 0.07,       0, statusY, 0.05));

  for (let i = 0; i < N; i++) {
    add(`dot_${i}`, planeMesh(
      track(makeDotTex(i === state.activeIdx)),
      dotSz, dotSz, -totalDotW / 2 + i * dotGap, dotsY, 0.05,
    ));
    state.ui[`dot_${i}`].userData.dotIdx = i;
  }

  add('progress', planeMesh(track(makeProgressTex(0)), progressW, 0.022, 0, progY, 0.05));

  for (let i = 0; i < POOL; i++) {
    const idx = i % N;
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: _imgTexCache[idx] },
        time:     { value: 0 },
        seed:     { value: idx * 2.17 },
        opacity:  { value: 1 },
      },
      vertexShader:   GalleryShader.vertexShader,
      fragmentShader: GalleryShader.fragmentShader,
      transparent: true,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(iw, ih), mat);
    mesh.userData = { idx, slot: i };
    state.group.add(mesh);
    state.meshes.push(mesh);

    if (!_imgTexCache[idx]) {
      new THREE.TextureLoader().load(IMG_PATHS[idx], tex => {
        tex.minFilter = tex.magFilter = THREE.LinearFilter;
        _imgTexCache[idx] = tex;
        state.meshes.forEach(m => {
          if (m.userData.idx === idx && (m.material as any).uniforms)
            (m.material as any).uniforms.tDiffuse.value = tex;
        });
      });
    }
  }
}

export const resizeGallery = (scene: THREE.Scene, state: GalleryState) => buildGallery(scene, state);

export function updateGallery(state: GalleryState, t: number) {
  if (!state.group) return;

  const hw = camHalfW(), step = galStep(), strip = galStrip();
  let closestDist = Infinity, closestIdx = 0;

  state.meshes.forEach(m => {
    if (m.userData.slot == null) return;
    let x = m.userData.slot * step - state.offset;
    while (x >  strip / 2) x -= strip;
    while (x < -strip / 2) x += strip;
    m.position.x = x;

    const u = (m.material as any).uniforms;
    if (!u) return;

    // Squared curve: stays bright near centre, drops fast at screen edge
    const distRatio = THREE.MathUtils.clamp(Math.abs(x) / (hw * 1.05), 0, 1);
    u.opacity.value = 1.0 - distRatio * distRatio;
    u.time.value    = t;

    if (Math.abs(x) < closestDist) { closestDist = Math.abs(x); closestIdx = m.userData.idx; }
  });

  if (closestIdx !== state.activeIdx) {
    state.activeIdx = closestIdx;

    for (let i = 0; i < N; i++) {
      const m = state.ui[`dot_${i}`];
      if (m) swapTex(state, m, makeDotTex(i === state.activeIdx));
    }
    swapTex(state, state.ui.progress,      makeProgressTex(N > 1 ? state.activeIdx / (N - 1) : 1));
    swapTex(state, state.ui.counter,       makeCounterTex(state.activeIdx + 1, N));
    swapTex(state, state.ui.missionTitle,  makeMissionTitleTex(MISSION_TITLES[state.activeIdx] ?? ''));
    swapTex(state, state.ui.missionTag,    makeMissionTagTex(MISSION_TAGS[state.activeIdx] ?? ''));
    swapTex(state, state.ui.missionStatus, makeStatusTex(state.activeIdx));
  }

  const pulse = 0.65 + Math.sin(t * 1.5) * 0.2;
  if (state.ui.arrowL) (state.ui.arrowL.material as THREE.MeshBasicMaterial).opacity = pulse;
  if (state.ui.arrowR) (state.ui.arrowR.material as THREE.MeshBasicMaterial).opacity = pulse;

  const subFade = 0.7 + Math.sin(t * 0.8) * 0.08;
  if (state.ui.missionTitle)  (state.ui.missionTitle.material  as THREE.MeshBasicMaterial).opacity = subFade;
  if (state.ui.missionTag)    (state.ui.missionTag.material    as THREE.MeshBasicMaterial).opacity = subFade * 0.8;
  if (state.ui.missionStatus) (state.ui.missionStatus.material as THREE.MeshBasicMaterial).opacity = 0.75;
}

export interface CenterImageState {
  mesh: THREE.Mesh | null;
  hover: boolean;
  evapState: 'idle' | 'evaporating' | 'done' | 'reforming';
  evapT: number;
  reformTimer: number;
}

export function createCenterImageState(): CenterImageState {
  return { mesh: null, hover: false, evapState: 'idle', evapT: 0, reformTimer: 0 };
}

export function buildCenterImage(scene: THREE.Scene, state: CenterImageState) {
  if (state.mesh) {
    scene.remove(state.mesh);
    state.mesh.geometry.dispose();
    (state.mesh.material as THREE.Material).dispose();
    state.mesh = null;
  }
  const size = centerImgSize();
  const existingTex = (_imgTexCache as any)['_center'] as THREE.Texture | undefined;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse:  { value: existingTex ?? null },
      time:      { value: 0 },
      hover:     { value: 0.0 },
      evaporate: { value: state.evapT },
      evapSeed:  { value: Math.random() * 100 },
    },
    vertexShader:   CenterImageShader.vertexShader,
    fragmentShader: CenterImageShader.fragmentShader,
    transparent: true, depthWrite: false,
  });
  state.mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  state.mesh.position.set(0, 0, 0.2);
  scene.add(state.mesh);

  if (!existingTex) {
    new THREE.TextureLoader().load('/SsPepHc3.png', tex => {
      tex.minFilter = tex.magFilter = THREE.LinearFilter;
      (_imgTexCache as any)['_center'] = tex;
      mat.uniforms.tDiffuse.value = tex;
    });
  }
}

export function resizeCenterImage(state: CenterImageState) {
  if (!state.mesh) return;
  const size = centerImgSize();
  state.mesh.geometry.dispose();
  state.mesh.geometry = new THREE.PlaneGeometry(size, size);
}

export function triggerEvaporation(state: CenterImageState) {
  if (state.evapState === 'idle' || state.evapState === 'done') {
    state.evapState = 'evaporating';
    const u = (state.mesh?.material as any)?.uniforms;
    if (u) u.evapSeed.value = Math.random() * 100;
  }
}

export function tickCenterImage(state: CenterImageState, dt: number, t: number) {
  if (!state.mesh) return;
  const u = (state.mesh.material as any).uniforms;

  if (state.evapState === 'evaporating') {
    state.evapT = Math.min(state.evapT + dt * 0.55, 1.0);
    if (state.evapT >= 1.0) { state.evapT = 1.0; state.evapState = 'done'; state.reformTimer = 0; }
  } else if (state.evapState === 'done') {
    state.reformTimer += dt;
    if (state.reformTimer >= 0.7) state.evapState = 'reforming';
  } else if (state.evapState === 'reforming') {
    state.evapT = Math.max(state.evapT - dt * 0.45, 0.0);
    if (state.evapT <= 0.0) { state.evapT = 0.0; state.evapState = 'idle'; }
  }

  u.evaporate.value = state.evapT;
  u.time.value = t;
  u.hover.value += ((state.hover ? 1.0 : 0.0) - u.hover.value) * 0.08;
}