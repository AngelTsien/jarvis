// 3D 全息核心 + 量子纠缠粒子（Three.js 本地 vendor，无 CDN）
import * as THREE from './vendor/three.module.min.js';
const JV = window.JV; if (!JV) throw new Error('app.js 未加载');
const mobile = matchMedia('(max-width:820px)').matches || navigator.maxTouchPoints > 1;
const cv = document.createElement('canvas'); cv.id = 'gl'; document.body.prepend(cv);
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: !mobile, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, 1, 0.1, 200); cam.position.z = 14;
const C = new THREE.Color('#00e5ff'), M = new THREE.Color('#ff2bd6'), O = new THREE.Color('#ff9a1f');
// 发光贴图（代替 bloom 后处理，手机也流畅）
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, '#fff'); r.addColorStop(0.2, 'rgba(255,255,255,.8)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const add = (m) => (m.blending = THREE.AdditiveBlending, m.transparent = true, m.depthWrite = false, m);
const core = new THREE.Group(); scene.add(core);
// 核心光球 + 光晕
const orb = new THREE.Sprite(add(new THREE.SpriteMaterial({ map: glowTex, color: '#bff' }))); orb.scale.set(3, 3, 1); core.add(orb);
const halo = new THREE.Sprite(add(new THREE.SpriteMaterial({ map: glowTex, color: C, opacity: .5 }))); halo.scale.set(9, 9, 1); core.add(halo);
const tri = new THREE.Mesh(new THREE.TorusGeometry(1.1, .05, 6, 3), add(new THREE.MeshBasicMaterial({ color: O }))); core.add(tri);
// 多层倾斜旋转光环（分段弧 + 外发光双层）
const rings = [];
[[2.0, C, .5, .3, 6], [2.6, O, -.8, 1.1, 3], [3.2, C, .3, -.6, 8], [3.9, M, -.25, .2, 4], [4.6, C, .15, 1.4, 2]].forEach(([r, col, sp, tilt, n], i) => {
  const g = new THREE.Group(); g.rotation.x = tilt; g.rotation.y = i * .5;
  for (let k = 0; k < n; k++) { const a = Math.PI * 2 / n;
    [[.035, 1], [.12, .25]].forEach(([w, op]) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, w, 6, 48, a * .62), add(new THREE.MeshBasicMaterial({ color: col, opacity: op }))); m.rotation.z = k * a; g.add(m); }); }
  core.add(g); rings.push([g, sp]);
});
// 粒子轨道壳层
function shell(n, r, col, size) { const p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, t = Math.random() * 6.283, s = Math.sqrt(1 - u * u), rr = r * (0.92 + Math.random() * .16);
  p.set([rr * s * Math.cos(t), rr * u, rr * s * Math.sin(t)], i * 3); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const pts = new THREE.Points(g, add(new THREE.PointsMaterial({ map: glowTex, color: col, size, sizeAttenuation: true }))); core.add(pts); return pts; }
const shells = [shell(mobile ? 500 : 1200, 5.2, C, .12), shell(mobile ? 300 : 700, 6.2, M, .1)];
// 背景粒子场
const N = mobile ? 1500 : 4000, bp = new Float32Array(N * 3); for (let i = 0; i < N; i++) bp.set([(Math.random() - .5) * 80, (Math.random() - .5) * 50, -Math.random() * 60], i * 3);
const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(bp, 3));
const field = new THREE.Points(bg, add(new THREE.PointsMaterial({ map: glowTex, color: '#4af', size: .18, opacity: .6 }))); scene.add(field);
// 量子纠缠：核心 ↔ 面板的脉冲光束 + 成对粒子
const links = []; const SEG = 40;
function makeLink(el, col) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SEG * 3), 3));
  const line = new THREE.Line(g, add(new THREE.LineBasicMaterial({ color: col, opacity: .5 }))); scene.add(line);
  const pair = [0, 1].map(() => { const s = new THREE.Sprite(add(new THREE.SpriteMaterial({ map: glowTex, color: col }))); s.scale.set(.5, .5, 1); scene.add(s); return s; });
  links.push({ el, line, pair, ph: Math.random() * 6, col }); }
document.querySelectorAll('aside .panel').forEach((el, i) => makeLink(el, i % 2 ? M : C));
// 屏幕坐标 → z=0 平面世界坐标
const v = new THREE.Vector3(); function toWorld(x, y) { v.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1, .5).unproject(cam); const d = v.sub(cam.position).normalize(); return cam.position.clone().add(d.multiplyScalar(-cam.position.z / d.z)); }
let corePos = new THREE.Vector3(), baseScale = 1;
function layout() { renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
  const r = document.querySelector('#reactor').getBoundingClientRect(); corePos = toWorld(r.left + r.width / 2, r.top + r.height / 2);
  const wh = toWorld(r.left, r.top).distanceTo(toWorld(r.right, r.top)); const sc = Math.min(wh, toWorld(r.left, r.top).distanceTo(toWorld(r.left, r.bottom))) / (mobile ? 16 : 14); baseScale = Math.max(sc, .3); core.position.copy(corePos); }
addEventListener('resize', layout); layout(); setTimeout(layout, 500);
// 视差：鼠标 / 陀螺仪
let tx = 0, ty = 0, px = 0, py = 0;
addEventListener('pointermove', e => { tx = e.clientX / innerWidth - .5; ty = e.clientY / innerHeight - .5; });
addEventListener('deviceorientation', e => { if (e.gamma != null) { tx = Math.max(-.5, Math.min(.5, e.gamma / 60)); ty = Math.max(-.5, Math.min(.5, (e.beta - 45) / 60)); } });
const root = document.documentElement; let lv = 0, last = performance.now(), slow = 0;
function loop(t) {
  const dt = Math.min((t - last) / 1000, .1); last = t; if (dt > 1 / 40) { if (++slow > 120 && renderer.getPixelRatio() > 1) { renderer.setPixelRatio(1); layout(); } } else slow = 0;
  lv += (JV.level() - lv) * .15; const st = JV.state(); const listen = st === 'listen';
  px += (tx - px) * .06; py += (ty - py) * .06; root.style.setProperty('--px', px.toFixed(3)); root.style.setProperty('--py', py.toFixed(3));
  cam.position.x = px * 3; cam.position.y = -py * 2; cam.lookAt(cam.position.x * .5, cam.position.y * .5, 0);
  core.scale.setScalar(baseScale * (JV.zoom || 1)); const R = JV.rot; R.y += R.vy * dt; R.x += R.vx * dt; R.vy *= .92; R.vx *= .92; core.rotation.y = px * .6 + R.y; core.rotation.x = py * .4 + R.x;
  rings.forEach(([g, sp], i) => { g.rotation.z += sp * dt * (1 + lv * 2); g.scale.setScalar(1 + lv * .08 * (i % 2 ? 1 : -1)); });
  shells[0].rotation.y += dt * .15 * (1 + lv * 3); shells[1].rotation.y -= dt * .1 * (1 + lv * 3); shells[1].rotation.x += dt * .05;
  shells.forEach(s => s.scale.setScalar(1 + lv * .15));
  tri.rotation.z -= dt * .6; const pul = 1 + lv * .5 + Math.sin(t / 400) * .05; orb.scale.set(3 * pul, 3 * pul, 1); halo.scale.set(9 * pul, 9 * pul, 1);
  halo.material.color.copy(listen ? new THREE.Color('#39ff88') : st === 'busy' ? M : C);
  field.rotation.y = Math.sin(t / 20000) * .2; field.position.x = -px * 4; field.position.y = py * 3;
  // 纠缠光束：正弦扭动的贝塞尔 + 两颗反向同步粒子
  links.forEach(L => { const r = L.el.getBoundingClientRect(); if (!r.width) return; const end = toWorld(r.left + r.width / 2, r.top + r.height / 2), a = L.line.geometry.attributes.position;
    const mid = corePos.clone().lerp(end, .5).add(new THREE.Vector3(0, 0, 3 + Math.sin(t / 700 + L.ph) * 1.5));
    for (let i = 0; i < SEG; i++) { const u = i / (SEG - 1), w = Math.sin(u * Math.PI) * Math.sin(u * 18 - t / 150 + L.ph) * .25;
      const p = corePos.clone().multiplyScalar((1 - u) ** 2).add(mid.clone().multiplyScalar(2 * u * (1 - u))).add(end.clone().multiplyScalar(u * u)); a.setXYZ(i, p.x, p.y + w, p.z); }
    a.needsUpdate = true; L.line.material.opacity = .25 + .35 * (.5 + .5 * Math.sin(t / 300 + L.ph)) + lv * .3;
    const u = (t / 2200 + L.ph) % 1; [u, 1 - u].forEach((k, j) => { const i = Math.min(SEG - 1, Math.floor(k * SEG)); L.pair[j].position.set(a.getX(i), a.getY(i), a.getZ(i)); }); });
  renderer.render(scene, cam); requestAnimationFrame(loop);
}
document.body.classList.add('gl3d'); requestAnimationFrame(loop);
