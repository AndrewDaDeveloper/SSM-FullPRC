'use client';

export function initVFX() {
  let animId:          number | null = null;
  let destroyed               = false;
  let cleanupDrag:     (() => void) | null = null;
  let resizeHandler:   (() => void) | null = null;
  let onContextLost:   ((e: Event) => void) | null = null;
  let onContextRestored: (() => void) | null = null;

  const CAM_H   = 2.2;
  const isSmall = () => window.innerWidth < 480;

  import('three').then(async (THREE) => {
    if (destroyed) return;

    const [
      { EffectComposer },
      { RenderPass },
      { ShaderPass },
      { initCorridorVFX },
      { PostShader, ChromaShader },
      {
        camHalfW, scrollRange,
        createGalleryState, buildGallery, updateGallery, resizeGallery,
        createCenterImageState, buildCenterImage, resizeCenterImage,
        triggerEvaporation, tickCenterImage,
      },
    ] = await Promise.all([
      import('three/addons/postprocessing/EffectComposer.js'),
      import('three/addons/postprocessing/RenderPass.js'),
      import('three/addons/postprocessing/ShaderPass.js'),
      import('./corridorVFX'),
      import('./postFX'),
      import('./vfxObjects'),
    ]);

    if (destroyed) return;

    let mouseX = 0.5, mouseY = 0.5;
    let scrollEl: HTMLDivElement | null = null;
    let scrollY = 0, camY = 0;
    let resT: ReturnType<typeof setTimeout>;

    const gallery   = createGalleryState();
    const center    = createCenterImageState();
    const raycaster = new THREE.Raycaster();
    const ndcMouse  = new THREE.Vector2();

    function getNDC(clientX: number, clientY: number) {
      ndcMouse.x =  (clientX / window.innerWidth)  * 2 - 1;
      ndcMouse.y = -(clientY / window.innerHeight) * 2 + 1;
    }

    function hitsCenterImage(clientX: number, clientY: number) {
      if (!center.mesh) return false;
      getNDC(clientX, clientY);
      raycaster.setFromCamera(ndcMouse, camera);
      return raycaster.intersectObject(center.mesh).length > 0;
    }

    const ex = (e: MouseEvent | TouchEvent) => 'touches' in e ? e.touches[0].clientX : e.clientX;
    const ey = (e: MouseEvent | TouchEvent) => 'touches' in e ? e.touches[0].clientY : e.clientY;

    function nearGal(cy: number) {
      if (!gallery.group) return false;
      const wy = gallery.group.position.y - camY;
      const sy = (1 - (wy + 1.5) / 3) * window.innerHeight;
      const ih = (1.25 / 3) * window.innerHeight;
      return cy > sy - ih && cy < sy + ih;
    }

    function setupDrag(): () => void {
      const dn = (e: MouseEvent | TouchEvent) => {
        if (!nearGal(ey(e))) return;
        e.preventDefault();
        gallery.drag = { on: true, sx: ex(e), so: gallery.offset, vx: 0, lx: ex(e), lt: performance.now() };
      };
      const mv = (e: MouseEvent | TouchEvent) => {
        if (!gallery.drag.on) return;
        e.preventDefault();
        const x = ex(e), now = performance.now(), dt = now - gallery.drag.lt;
        const wpx = (camHalfW() * 2) / window.innerWidth;
        gallery.drag.vx  = dt > 0 ? -(x - gallery.drag.lx) * wpx / (dt / 1000) : gallery.drag.vx;
        gallery.offset   = gallery.drag.so - (x - gallery.drag.sx) * wpx;
        gallery.drag.lx  = x;
        gallery.drag.lt  = now;
      };
      const up = () => { gallery.drag.on = false; };

      (['mousedown', 'touchstart'] as const).forEach(ev => window.addEventListener(ev, dn as any, { passive: false }));
      (['mousemove', 'touchmove']  as const).forEach(ev => window.addEventListener(ev, mv as any, { passive: false }));
      (['mouseup',  'touchend']    as const).forEach(ev => window.addEventListener(ev, up));

      return () => {
        (['mousedown', 'touchstart'] as const).forEach(ev => window.removeEventListener(ev, dn as any));
        (['mousemove', 'touchmove']  as const).forEach(ev => window.removeEventListener(ev, mv as any));
        (['mouseup',  'touchend']    as const).forEach(ev => window.removeEventListener(ev, up));
      };
    }

    const scene    = new THREE.Scene();
    const camera   = new THREE.OrthographicCamera(-camHalfW(), camHalfW(), CAM_H, -CAM_H, 0.1, 100);
    camera.position.set(0, 0, 5);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, isSmall() ? 1.5 : 2));
    renderer.domElement.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:500;';
    document.body.appendChild(renderer.domElement);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    const postPass = new ShaderPass(PostShader);
    postPass.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
    composer.addPass(postPass);
    composer.addPass(new ShaderPass(ChromaShader));

    const corridorVFX = initCorridorVFX(composer);

    buildCenterImage(scene, center);
    buildGallery(scene, gallery);
    cleanupDrag = setupDrag();

    // Clean up any existing scroll element
    const existingScroll = document.querySelector('[data-vfx-scroll]');
    if (existingScroll) existingScroll.remove();

    scrollEl = document.createElement('div');
    scrollEl.setAttribute('data-vfx-scroll', 'true');
    scrollEl.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;overflow-y:scroll;z-index:499;pointer-events:auto;';
    const inner = document.createElement('div');
    inner.style.cssText = 'width:100%;height:150vh;pointer-events:none;';
    scrollEl.appendChild(inner);
    document.body.appendChild(scrollEl);
    scrollEl.addEventListener('scroll', () => { scrollY = scrollEl!.scrollTop; }, { passive: true });

    const onHit = (clientX: number, clientY: number) => {
      if (hitsCenterImage(clientX, clientY)) {
        triggerEvaporation(center);
        setTimeout(() => corridorVFX.start(), 1000);
      }
    };
    scrollEl.addEventListener('click',    e => onHit(e.clientX, e.clientY));
    scrollEl.addEventListener('touchend', e => { const t = e.changedTouches[0]; onHit(t.clientX, t.clientY); });
    scrollEl.addEventListener('mousemove', e => {
      mouseX = e.clientX / window.innerWidth;
      mouseY = e.clientY / window.innerHeight;
      center.hover = hitsCenterImage(e.clientX, e.clientY);
      scrollEl!.style.cursor = center.hover ? 'pointer' : 'default';
    });
    window.addEventListener('touchmove', e => {
      mouseX = e.touches[0].clientX / window.innerWidth;
      mouseY = e.touches[0].clientY / window.innerHeight;
    }, { passive: true });

    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t  = clock.getElapsedTime();

      corridorVFX.tick();
      tickCenterImage(center, dt, t);

      const norm = Math.min(scrollY / Math.max(scrollEl!.scrollHeight - window.innerHeight, 1), 1);
      camY += (-norm * scrollRange() - camY) * 0.04;
      camera.top    = CAM_H + camY;
      camera.bottom = -CAM_H + camY;
      camera.updateProjectionMatrix();

      if (!gallery.drag.on) { gallery.drag.vx *= 0.91; gallery.offset += gallery.drag.vx * dt; }
      updateGallery(gallery, t);

      postPass.uniforms.time.value  = t;
      postPass.uniforms.mouse.value.set(mouseX, mouseY);

      composer.render();
    };

    const onVis = () => {
      if (document.hidden) {
        if (animId) { cancelAnimationFrame(animId); animId = null; }
      } else {
        clock.getDelta();
        if (!animId) animate();
      }
    };
    document.addEventListener('visibilitychange', onVis);

    onContextLost = (e: Event) => {
      e.preventDefault();
      if (animId) { cancelAnimationFrame(animId); animId = null; }
    };
    onContextRestored = () => { if (!animId) animate(); };
    renderer.domElement.addEventListener('webglcontextlost',     onContextLost,     false);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored, false);

    resizeHandler = () => {
      clearTimeout(resT);
      resT = setTimeout(() => {
        const nw = window.innerWidth, nh = window.innerHeight, hw = camHalfW();
        camera.left = -hw; camera.right = hw;
        camera.top  = CAM_H + camY; camera.bottom = -CAM_H + camY;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
        renderer.setPixelRatio(Math.min(devicePixelRatio, isSmall() ? 1.5 : 2));
        composer.setSize(nw, nh);
        postPass.uniforms.resolution.value.set(nw, nh);
        corridorVFX.onResize(nw, nh);
        resizeGallery(scene, gallery);
        resizeCenterImage(center);
      }, 100);
    };
    window.addEventListener('resize', resizeHandler);

    if (!destroyed) animate();

    const _destroy = () => {
      destroyed = true;
      if (animId) cancelAnimationFrame(animId);
      clearTimeout(resT);
      cleanupDrag?.();
      corridorVFX.destroy();
      document.removeEventListener('visibilitychange', onVis);
      if (resizeHandler)    window.removeEventListener('resize', resizeHandler);
      if (onContextLost)    renderer.domElement.removeEventListener('webglcontextlost',     onContextLost);
      if (onContextRestored)renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      renderer.domElement.remove();
      scrollEl?.remove();
      renderer.dispose();
      composer.dispose();
    };

    (initVFX as any)._destroy = _destroy;
  });

  return {
    destroy() {
      destroyed = true;
      if (animId) cancelAnimationFrame(animId);
      const _d = (initVFX as any)._destroy;
      if (typeof _d === 'function') _d();
    },
  };
}