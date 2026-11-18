import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createCampusModel } from './model.js';
import { createFloorReveal } from './floor-reveal.js';

const host = document.querySelector('[data-campus]');
function unavailable() {
  host.dataset.phase = 'unavailable';
  host.classList.remove('is-ready');
  const message = '暂时无法显示基地模型，请查看下方的空间功能介绍。';
  host.querySelector('.campus-loading').textContent = message;
  host.querySelector('.campus-status').textContent = message;
  document.querySelectorAll('[data-campus-view]').forEach(button => { button.disabled = true; });
}
if (host) initialise().catch(error => {
  console.error('Campus scene unavailable:', error);
  unavailable();
});

async function initialise() {
  const stage = host.querySelector('.campus-stage');
  const canvas = host.querySelector('canvas');
  const status = host.querySelector('.campus-status');
  const hint = document.querySelector('.campus-view-hint');
  const viewButtons = [...document.querySelectorAll('[data-campus-view]')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const events = new AbortController(), listenerOptions = { signal: events.signal };
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
  renderer.setClearColor(0x17090e, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const environment = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer);
  const environmentTarget = pmrem.fromScene(environment, .05);
  scene.environment = environmentTarget.texture;
  scene.environmentIntensity = .55;
  environment.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xeaf0ff, 0x725345, 1.5));
  const key = new THREE.DirectionalLight(0xffe4bf, 3.3);
  key.position.set(-14, 28, 12); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: .5, far: 70 });
  key.shadow.bias = -.0004; key.shadow.normalBias = .03; key.shadow.radius = 3; scene.add(key);
  const fill = new THREE.DirectionalLight(0xc2d5ef, 1.1); fill.position.set(18, 12, -17); scene.add(fill);
  const camera = new THREE.OrthographicCamera(-22, 22, 17, -17, .1, 180);
  const perspective = new THREE.Vector3(28, 31, 35), target = new THREE.Vector3(0, 1.35, 0);
  camera.position.copy(perspective); camera.lookAt(target);
  const controls = new OrbitControls(camera, stage);
  Object.assign(controls, { enabled: false, enableDamping: true, dampingFactor: .08, enablePan: false,
    enableZoom: true, zoomSpeed: .6, minZoom: .65, maxZoom: 1.8, minPolarAngle: .13,
    maxPolarAngle: Math.PI * .46, autoRotate: false, rotateSpeed: .55 });
  controls.target.copy(target);

  const { group, update, level2, secondFloorFootprint, secondFloorElevation } = createCampusModel();
  scene.add(group);
  const floorReveal = createFloorReveal({ level2, footprint: secondFloorFootprint, elevation: secondFloorElevation, camera, stage, reduced: () => reduced.matches, onRequest: request,
    onChange: state => { host.dataset.floorReveal = state; if (state === 'closed') host.dataset.floorRevealAmount = '0'; } });
  const orbitAxis = new THREE.Vector3(0, 1, 0), orbitOffset = new THREE.Vector3();
  const ease = t => t * t * (3 - 2 * t), clamp = t => Math.min(1, Math.max(0, t));
  let finalZoom = 1.13, dirty = true, dragging = false, inView = true, lost = false, suspended = false, disposed = false, compiled = false, raf = 0;
  let last = performance.now(), lastInteraction = last, statsAt = last, frame = 0;
  function request() {
    if (!raf && compiled && !lost && !disposed && !suspended && inView && !document.hidden) raf = requestAnimationFrame(tick);
  }

  function resetView() {
    floorReveal.reset();
    // Clear drag inertia before restoring the fixed effect view.
    controls.enableDamping = false; controls.update(); controls.enableDamping = true;
    camera.position.copy(perspective); controls.target.copy(target);
    camera.zoom = finalZoom; camera.updateProjectionMatrix(); camera.lookAt(target);
    controls.update(); dirty = true;
  }
  function setView(view) {
    const interactive = view === 'space';
    controls.enabled = false; dragging = false; stage.classList.remove('is-dragging');
    resetView();
    controls.enabled = interactive;
    host.dataset.phase = interactive ? 'space' : 'render';
    host.dataset.rotation = 'paused';
    const message = interactive
      ? '拖动旋转，滚轮缩放；悬停二楼查看一楼。触屏点击二楼，或聚焦模型后按回车展开。'
      : '空间模型示意，以固定视角呈现两层布局与材质。';
    hint.textContent = message; status.textContent = message;
    stage.setAttribute('aria-label', interactive ? '可交互的两层基地模型' : '两层基地的三维效果视图');
    stage.setAttribute('role', interactive ? 'region' : 'img');
    stage.tabIndex = interactive ? 0 : -1;
    viewButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.campusView === view)));
    lastInteraction = performance.now(); dirty = true; request();
  }
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    const half = 15.4;
    camera.left = -half * w / h; camera.right = half * w / h; camera.top = half; camera.bottom = -half;
    finalZoom = Math.min(1.13, w / h * .85);
    camera.zoom = finalZoom * (1 - (1 - floorReveal.viewScale) * floorReveal.amount);
    camera.updateProjectionMatrix(); dirty = true; request();
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(stage); resize();
  viewButtons.forEach(button => button.addEventListener('click', () => setView(button.dataset.campusView), listenerOptions));
  controls.addEventListener('change', () => { dirty = true; host.dataset.azimuth = controls.getAzimuthalAngle().toFixed(3); host.dataset.polar = controls.getPolarAngle().toFixed(3); request(); });
  controls.addEventListener('start', () => { dragging = true; lastInteraction = performance.now(); stage.classList.add('is-dragging'); request(); });
  controls.addEventListener('end', () => { dragging = false; lastInteraction = performance.now(); stage.classList.remove('is-dragging'); request(); });
  stage.addEventListener('keydown', event => {
    if (!controls.enabled || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') resetView();
    else {
      const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      spherical.theta += event.key === 'ArrowLeft' ? .16 : event.key === 'ArrowRight' ? -.16 : 0;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi + (event.key === 'ArrowUp' ? -.10 : event.key === 'ArrowDown' ? .10 : 0), .13, Math.PI * .46);
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
    }
    lastInteraction = performance.now(); controls.update(); dirty = true; request();
  }, listenerOptions);
  const intersectionObserver = new IntersectionObserver(entries => { inView = entries[0].isIntersecting; last = performance.now(); dirty = true; request(); }, { threshold: .05 });
  intersectionObserver.observe(host);
  document.addEventListener('visibilitychange', () => { last = performance.now(); dirty = true; request(); }, listenerOptions);
  reduced.addEventListener('change', () => { lastInteraction = performance.now(); dirty = true; request(); }, listenerOptions);
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); lost = true; controls.enabled = false; cancelAnimationFrame(raf); raf = 0; unavailable(); }, listenerOptions);
  function dispose() {
    disposed = true; cancelAnimationFrame(raf); raf = 0; events.abort();
    resizeObserver.disconnect(); intersectionObserver.disconnect(); floorReveal.dispose(); controls.dispose();
    const geometries = new Set(), materials = new Set(), textures = new Set();
    group.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      for (const material of object.material ? Array.isArray(object.material) ? object.material : [object.material] : []) {
        materials.add(material);
        Object.values(material).forEach(value => { if (value?.isTexture) textures.add(value); });
      }
    });
    geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose());
    key.shadow.dispose(); environmentTarget.dispose(); renderer.dispose();
  }
  addEventListener('pagehide', event => { if (event.persisted) { suspended = true; cancelAnimationFrame(raf); raf = 0; } else dispose(); }, listenerOptions);
  addEventListener('pageshow', event => { if (event.persisted) { suspended = false; last = performance.now(); dirty = true; request(); } }, listenerOptions);
  function tick(now) {
    raf = 0;
    if (lost || disposed || suspended || !inView || document.hidden) return;
    const dt = Math.min((now - last) / 1000, .05); last = now;
    if (controls.enabled) {
      controls.update();
      const previousReveal = floorReveal.amount;
      if (floorReveal.update(now, true, dragging)) {
        const delta = floorReveal.amount - previousReveal, reduction = 1 - floorReveal.viewScale;
        camera.zoom *= (1 - reduction * floorReveal.amount) / (1 - reduction * previousReveal);
        camera.position.y += 1.5 * delta; controls.target.y += 1.5 * delta;
        camera.updateProjectionMatrix(); controls.update(); dirty = true;
        host.dataset.floorRevealAmount = floorReveal.amount.toFixed(3);
      }
      if (floorReveal.active) lastInteraction = now;
      const rotationReady = !reduced.matches && !dragging && !floorReveal.active;
      const resume = ease(clamp((now - lastInteraction - 600) / 1200));
      host.dataset.rotation = dragging ? 'dragging' : floorReveal.active ? 'inspection' : rotationReady && resume > 0 ? 'auto' : 'paused';
      if (rotationReady && resume > 0) {
        orbitOffset.copy(camera.position).sub(controls.target).applyAxisAngle(orbitAxis, dt * (Math.PI * 2 / 150) * resume);
        camera.position.copy(controls.target).add(orbitOffset); camera.lookAt(controls.target); dirty = true;
      }
      update?.(now / 1000);
      if (!reduced.matches || dragging || floorReveal.pending) request();
    }
    if (dirty) { renderer.render(scene, camera); dirty = false; frame++; }
    if (now - statsAt > 1500) { host.dataset.fps = (frame * 1000 / (now - statsAt)).toFixed(0); host.dataset.drawCalls = renderer.info.render.calls; statsAt = now; frame = 0; }
  }
  setView('render');
  update?.(0);
  try { await renderer.compileAsync(scene, camera); } catch (error) { dispose(); throw error; }
  if (lost || disposed) return;
  compiled = true;
  renderer.render(scene, camera); dirty = false;
  host.classList.add('is-ready'); host.dataset.model = 'ready'; host.dataset.floors = '2'; host.dataset.introDuration = '0';
  viewButtons.forEach(button => { button.disabled = false; });
  let meshCount = 0; group.traverse(object => { if (object.isMesh) meshCount++; }); host.dataset.meshes = String(meshCount);
  request();
}
