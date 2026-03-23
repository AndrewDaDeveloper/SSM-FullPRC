import { hudState, dismissBoot } from '../store/hudStore';
import { subscribe } from 'valtio';

const vertexShader = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
varying vec2 vUv;
uniform float uTime;
uniform float uOpacity;
uniform sampler2D uTexture;
uniform vec2 uResolution;

vec2 zoom(vec2 uv, float t) { return (uv - .5) * t + .5; }

float rand(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5); }

void main() {
    float time = uTime;
    vec2 uv = vUv;
    vec2 p = uv * 2. - 1.;
    p.x *= uResolution.x / uResolution.y;
    float l = length(p);

    uv = zoom(uv, .82 + smoothstep(0., 1., pow(l, 2.) * .15));

    vec2 pos = uv;
    float r = texture2D(uTexture, pos + cos(time * 2. - time + pos.x) * .01).r;
    float g = texture2D(uTexture, pos + tan(time * .5 + pos.x - time) * .01).g;
    float b = texture2D(uTexture, pos - cos(time * 2. + time + pos.y) * .01).b;
    float a = texture2D(uTexture, pos).a;

    vec3 col = vec3(r, g, b);

    col *= 0.88 + sin(uv.y * uResolution.y * 0.5 + time * 80.) * 0.06;

    col += smoothstep(0.01, 0.0, min(fract(uv.x * 18.), fract(uv.y * 18.))) * 0.03;

    col *= 1.0 - l * l * 0.18;

    col += rand(uv + time * 0.01) * 0.018;

    gl_FragColor = vec4(col, a * uOpacity);
}
`;

function map(n: number, start: number, stop: number, start2: number, stop2: number) {
  return ((n - start) / (stop - start)) * (stop2 - start2) + start2;
}

function ease(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

class AsciiFilter {
  renderer: any;
  domElement: HTMLDivElement;
  pre: HTMLPreElement;
  canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private readonly invert: boolean;
  private readonly fontSize: number;
  private readonly fontFamily: string;
  private readonly charset: string;

  constructor(renderer: any, { fontSize = 12, fontFamily = "'Courier New', monospace", charset, invert = true } = {} as any) {
    this.renderer   = renderer;
    this.invert     = invert;
    this.fontSize   = fontSize;
    this.fontFamily = fontFamily;
    this.charset    = charset ?? ' .\'`^",:;Il!i~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$';

    this.domElement = document.createElement('div');
    this.domElement.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';

    this.pre = document.createElement('pre');
    this.domElement.appendChild(this.pre);

    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'none';
    this.domElement.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
  }

  setSize(width: number, height: number) {
    this.renderer.setSize(width, height);
    this.ctx.font = `${this.fontSize}px ${this.fontFamily}`;
    const charWidth = this.ctx.measureText('A').width;
    this.canvas.width  = Math.floor(width  / charWidth);
    this.canvas.height = Math.floor(height / this.fontSize);
    this.pre.style.cssText = `
      font-family:${this.fontFamily};font-size:${this.fontSize}px;
      margin:0;padding:0;line-height:1em;
      position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
      z-index:9;color:#ffffff;
    `;
  }

  render(scene: any, camera: any) {
    this.renderer.render(scene, camera);
    const { width: w, height: h } = this.canvas;
    if (!w || !h) return;
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.drawImage(this.renderer.domElement, 0, 0, w, h);
    const imgData = this.ctx.getImageData(0, 0, w, h).data;
    const len = this.charset.length - 1;
    let str = '';
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (x + y * w) * 4;
        if (imgData[i + 3] === 0) { str += ' '; continue; }
        const gray = (0.3 * imgData[i] + 0.6 * imgData[i + 1] + 0.1 * imgData[i + 2]) / 255;
        let idx = Math.floor((1 - gray) * len);
        if (this.invert) idx = len - idx;
        str += this.charset[idx];
      }
      str += '\n';
    }
    this.pre.innerHTML = str;
  }
}

class CanvasTxt {
  canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private readonly txt: string;
  private readonly font: string;
  private readonly color: string;

  constructor(txt: string, { fontSize = 200, fontFamily = 'Arial', color = '#fdf9f3' } = {} as any) {
    this.canvas = document.createElement('canvas');
    this.ctx    = this.canvas.getContext('2d')!;
    this.txt    = txt;
    this.color  = color;
    this.font   = `400 ${fontSize}px ${fontFamily}`;
  }

  resize() {
    this.ctx.font = this.font;
    const m = this.ctx.measureText(this.txt);
    this.canvas.width  = Math.ceil(m.width) + 20;
    this.canvas.height = Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) + 20;
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = this.color;
    this.ctx.font = this.font;
    const m = this.ctx.measureText(this.txt);
    this.ctx.fillText(this.txt, 10, 10 + m.actualBoundingBoxAscent);
  }

  get width()   { return this.canvas.width; }
  get height()  { return this.canvas.height; }
  get texture() { return this.canvas; }
}

class CanvAscii {
  private readonly container: HTMLElement;
  private readonly THREE: any;
  private readonly fadeDuration = 1500;
  private readonly planeBaseHeight: number;

  width: number; height: number;
  mouse: { x: number; y: number };
  camera: any; scene: any;
  textCanvas!: CanvasTxt;
  texture!: any; geometry!: any;
  material!: any; mesh!: any;
  renderer!: any; filter!: AsciiFilter;
  animationFrameId = 0;
  startTime = 0;

  constructor(
    { text, asciiFontSize, textFontSize, textColor, planeBaseHeight }: any,
    containerElem: HTMLElement, width: number, height: number, THREE: any
  ) {
    this.container       = containerElem;
    this.width           = width;
    this.height          = height;
    this.THREE           = THREE;
    this.planeBaseHeight = planeBaseHeight;
    this.mouse           = { x: width / 2, y: height / 2 };

    this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
    this.camera.position.z = 30;
    this.scene = new THREE.Scene();
    this.onMouseMove = this.onMouseMove.bind(this);

    this.textCanvas = new CanvasTxt(text, {
      fontSize: textFontSize, fontFamily: '"VT323"', color: textColor
    });

    this.filter = new AsciiFilter(
      new THREE.WebGLRenderer({ antialias: false, alpha: true }),
      { fontFamily: '"VT323"', fontSize: asciiFontSize, invert: true }
    );
  }

  async init() {
    try { await document.fonts.load('400 120px "VT323"'); } catch (e) {}
    await document.fonts.ready;

    this.textCanvas.resize();
    this.textCanvas.render();

    const THREE = this.THREE;
    this.texture = new THREE.CanvasTexture(this.textCanvas.texture);
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.magFilter = THREE.NearestFilter;

    const aspect = this.textCanvas.width / this.textCanvas.height;
    this.geometry = new THREE.PlaneGeometry(this.planeBaseHeight * aspect, this.planeBaseHeight, 1, 1);
    this.material = new THREE.ShaderMaterial({
      vertexShader, fragmentShader, transparent: true,
      uniforms: {
        uTime:       { value: 0 },
        uOpacity:    { value: 0 },
        uTexture:    { value: this.texture },
        uResolution: { value: new THREE.Vector2(this.width, this.height) },
      }
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.scene.add(this.mesh);

    this.renderer = this.filter.renderer;
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x000000, 0);
    this.container.appendChild(this.filter.domElement);
    this.setSize(this.width, this.height);
    this.container.addEventListener('mousemove', this.onMouseMove);
  }

  setSize(w: number, h: number) {
    this.width  = w;
    this.height = h;
    this.camera.aspect = w / h;

    const vFov  = (this.camera.fov * Math.PI) / 180;
    const viewH = 2 * Math.tan(vFov / 2) * this.camera.position.z;
    const viewW = viewH * this.camera.aspect;
    const scale = Math.min(
      viewW / this.geometry.parameters.width,
      viewH / this.geometry.parameters.height
    ) * 0.8;
    this.mesh?.scale.set(scale, scale, 1);

    this.camera.updateProjectionMatrix();
    this.filter.setSize(w, h);
    if (this.material) {
      this.material.uniforms.uResolution.value.set(w, h);
    }
  }

  load() {
    this.startTime = performance.now();
    const frame = () => {
      this.animationFrameId = requestAnimationFrame(frame);
      const now     = performance.now();
      const eased   = ease(Math.min((now - this.startTime) / this.fadeDuration, 1));
      this.textCanvas.render();
      this.texture.needsUpdate = true;
      this.material.uniforms.uTime.value    = Math.sin(now * 0.001);
      this.material.uniforms.uOpacity.value = eased;
      this.mesh.rotation.x += (map(this.mouse.y, 0, this.height,  0.5, -0.5) - this.mesh.rotation.x) * 0.05;
      this.mesh.rotation.y += (map(this.mouse.x, 0, this.width,  -0.5,  0.5) - this.mesh.rotation.y) * 0.05;
      this.filter.render(this.scene, this.camera);
    };
    frame();
  }

  onMouseMove(evt: MouseEvent) {
    const b = this.container.getBoundingClientRect();
    this.mouse = { x: evt.clientX - b.left, y: evt.clientY - b.top };
  }

  dispose() {
    cancelAnimationFrame(this.animationFrameId);
    this.filter.domElement.parentNode?.removeChild(this.filter.domElement);
    this.container.removeEventListener('mousemove', this.onMouseMove);
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
  }
}

export function initBootScreen() {
  const bootScreen = document.getElementById('boot-screen');
  if (!bootScreen) return;

  const bs = bootScreen as HTMLElement;
  bs.style.cssText = `
    position:fixed;inset:0;z-index:10000;
    background:#000;overflow:hidden;
    font-family:'VT323',monospace;
    font-size:14px;color:#fff;
  `;

  bs.innerHTML = `
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=VT323&display=swap" rel="stylesheet">
    <canvas id="boot-pixel-canvas"></canvas>
    <style>
      @keyframes bootFadeOut { 0% { opacity:1; } 100% { opacity:0; } }
      @keyframes blinkAnim   { 0%,100% { opacity:1; } 50% { opacity:0; } }
      #ascii-wrap.fading { animation: bootFadeOut 0.45s ease-in forwards; }
      #ascii-scene-container pre {
        margin:0;user-select:none;padding:0;line-height:1em;
        text-align:left;color:#ffffff;
      }
      #boot-enter-prompt {
        position:absolute;bottom:48px;left:50%;transform:translateX(-50%);
        font-family:'VT323',monospace;font-size:22px;
        color:#fff;letter-spacing:0.2em;text-transform:uppercase;
        animation:blinkAnim 1.06s ease-in-out infinite;
        z-index:20;white-space:nowrap;
      }
    </style>
    <div id="ascii-wrap" style="position:absolute;inset:0;z-index:1;display:flex;align-items:center;justify-content:center;">
      <div id="ascii-scene-container" style="position:absolute;inset:0;"></div>
      <div id="boot-enter-prompt">Press Enter to Continue</div>
    </div>
  `;

  const wrap = document.getElementById('ascii-wrap')!;
  let asciiInstance: CanvAscii | null = null;
  const ac     = new AbortController();
  const { signal } = ac;

  function loadThree(): Promise<any> {
    return new Promise((resolve, reject) => {
      if ((window as any).THREE) { resolve((window as any).THREE); return; }
      const s = document.createElement('script');
      s.src    = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
      s.onload = () => resolve((window as any).THREE);
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function startAsciiScene() {
    const THREE     = await loadThree();
    const container = document.getElementById('ascii-scene-container');
    if (!container) return;

    await new Promise(r => requestAnimationFrame(r));
    const w = container.clientWidth  || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;

    asciiInstance = new CanvAscii(
      { text: '⫷☠⫸', asciiFontSize: 7, textFontSize: 120, textColor: '#fdf9f3', planeBaseHeight: 6 },
      container, w, h, THREE
    );

    await asciiInstance.init();
    asciiInstance.load();

    window.addEventListener('resize', () => {
      asciiInstance?.setSize(container.clientWidth, container.clientHeight);
    }, { signal });
  }

  function runPixelDissolve(onDone: () => void) {
    const canvas = document.getElementById('boot-pixel-canvas') as HTMLCanvasElement;
    if (!canvas) { onDone(); return; }

    const PIXEL = 14;
    const W     = Math.ceil(window.innerWidth  / PIXEL);
    const H     = Math.ceil(window.innerHeight / PIXEL);
    const TOTAL = W * H;

    canvas.width  = W;
    canvas.height = H;
    canvas.style.cssText = `
      position:fixed;inset:0;z-index:0;
      width:100vw;height:100vh;
      image-rendering:pixelated;pointer-events:none;
    `;

    const ctx        = canvas.getContext('2d')!;
    const FADE_WINDOW = 0.18;
    const fadeStart  = new Float32Array(TOTAL);
    const order      = Array.from({ length: TOTAL }, (_, i) => i);

    for (let i = TOTAL - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (let i = 0; i < TOTAL; i++) {
      fadeStart[order[i]] = (i / TOTAL) * (1 - FADE_WINDOW);
    }

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    bs.style.background = 'transparent';

    const startT   = performance.now();
    const DURATION = 2200;

    function frame(now: number) {
      const raw = Math.min((now - startT) / DURATION, 1);
      const t   = ease(raw);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#000';
      for (let i = 0; i < TOTAL; i++) {
        const local = Math.min(Math.max((t - fadeStart[i]) / FADE_WINDOW, 0), 1);
        if (local >= 1) continue;
        ctx.globalAlpha = 1 - ease(local);
        ctx.fillRect(i % W, (i / W) | 0, 1, 1);
      }
      ctx.globalAlpha = 1;
      if (raw < 1) {
        requestAnimationFrame(frame);
      } else {
        canvas.remove();
        bs.style.display = 'none';
        hudState.phase = 'hud-building';
        document.getElementById('nav-overlay')
          ?.classList && setTimeout(() => document.getElementById('nav-overlay')!.classList.add('visible'), 800);
        asciiInstance?.dispose();
        asciiInstance = null;
        onDone();
      }
    }
    requestAnimationFrame(frame);
  }

  function triggerDismiss() {
    if (hudState.bootDismissed) return;
    dismissBoot();
  }

  subscribe(hudState, () => {
    if (!hudState.bootDismissed) return;
    ac.abort();
    wrap.classList.add('fading');
    setTimeout(() => runPixelDissolve(() => {}), 460);
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') triggerDismiss();
  }, { signal });

  bs.addEventListener('click',    triggerDismiss, { signal });
  bs.addEventListener('touchend', triggerDismiss, { signal });

  startAsciiScene();
}