// JARVIS 粒子人形 + 手部跟随（Three.js / MediaPipe 均为本地 vendor）
import * as THREE from './vendor/three.module.min.js';
const JV = window.JV;
const mobile = matchMedia('(max-width:820px)').matches || navigator.maxTouchPoints > 1;
const COUNT = mobile ? 15000 : 45000;
const cv = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, alpha: true });
const PR = Math.min(devicePixelRatio, mobile ? 1.5 : 2); renderer.setPixelRatio(PR);
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(35, 1, .05, 50);
const CY = 1.22; // 画面中心高度

/* ---------- 程序化人形：在椭球/胶囊体上采样，偏向表面 ---------- */
const pos = [], part = [], rnd = [];
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function rdir() { const u = Math.random() * 2 - 1, t = Math.random() * 6.283, s = Math.sqrt(1 - u * u); return V(s * Math.cos(t), u, s * Math.sin(t)); }
function ellipsoid(c, r, n, p) { for (let i = 0; i < n; i++) { const d = rdir().multiplyScalar(Math.pow(Math.random(), .22)); push(c.x + d.x * r.x, c.y + d.y * r.y, c.z + d.z * r.z, p); } }
function capsule(a, b, rad, n, p) { const ab = b.clone().sub(a); for (let i = 0; i < n; i++) { const d = rdir().multiplyScalar(rad * Math.pow(Math.random(), .22)), q = a.clone().addScaledVector(ab, Math.random()).add(d); push(q.x, q.y, q.z, p); } }
function push(x, y, z, p) { pos.push(x, y, z); part.push(p); rnd.push(Math.random()); }
const N = k => Math.round(COUNT * k);
ellipsoid(V(0, 1.68, 0), V(.1, .128, .112), N(.13), 1);          // 头
ellipsoid(V(0, 1.6, .075), V(.045, .03, .03), N(.01), 1);          // 下巴
capsule(V(0, 1.48, 0), V(0, 1.58, 0), .048, N(.02), 0);            // 脖子
ellipsoid(V(0, 1.3, 0), V(.2, .19, .11), N(.22), 0);               // 胸
ellipsoid(V(0, 1.06, 0), V(.155, .17, .095), N(.12), 0);           // 腹
ellipsoid(V(0, .9, 0), V(.17, .09, .1), N(.05), 0);                // 髋
capsule(V(-.2, 1.43, 0), V(.2, 1.43, 0), .06, N(.06), 0);          // 肩
for (const s of [-1, 1]) {
  capsule(V(s * .24, 1.42, 0), V(s * .28, 1.12, .01), .045, N(.07), 0);   // 上臂
  capsule(V(s * .28, 1.12, .01), V(s * .29, .87, .06), .037, N(.055), 0); // 前臂
  ellipsoid(V(s * .29, .81, .07), V(.03, .05, .022), N(.015), 0);          // 手
  ellipsoid(V(s * .038, 1.7, .1), V(.016, .007, .006), N(.006), 2);         // 眼睛
}
ellipsoid(V(0, 1.2, 0), V(1.1, .9, .6), N(.06), 3);                // 周围星尘
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
geo.setAttribute('part', new THREE.Float32BufferAttribute(part, 1));
geo.setAttribute('rnd', new THREE.Float32BufferAttribute(rnd, 1));

const U = { uT: { value: 0 }, uLevel: { value: 0 }, uListen: { value: 0 }, uYaw: { value: 0 }, uHead: { value: new THREE.Vector2() }, uLean: { value: new THREE.Vector2() },
  uHand: { value: V(0, 1.2, .3) }, uHandOn: { value: 0 }, uSize: { value: (mobile ? 3.2 : 3.4) * PR } };
const mat = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `
  attribute float part; attribute float rnd; uniform float uT,uLevel,uListen,uYaw,uHandOn,uSize; uniform vec2 uHead,uLean; uniform vec3 uHand;
  varying vec3 vC; varying float vA;
  mat3 rx(float a){float c=cos(a),s=sin(a);return mat3(1,0,0,0,c,s,0,-s,c);} mat3 ry(float a){float c=cos(a),s=sin(a);return mat3(c,0,-s,0,1,0,s,0,c);} mat3 rz(float a){float c=cos(a),s=sin(a);return mat3(c,s,0,-s,c,0,0,0,1);}
  void main(){
    vec3 p=position; vec3 o=position;
    if(part<2.5){
      if(part>0.5){ vec3 pv=vec3(0.,1.52,0.); p=ry(uHead.x)*rx(uHead.y)*(p-pv)+pv; }        // 头部转向
      float br=1.+.012*sin(uT*1.4)*smoothstep(.95,1.35,p.y)*smoothstep(1.5,1.35,p.y); p.xz*=br; // 呼吸
      vec3 hp=vec3(0.,.85,0.); p=rz(uLean.x)*rx(uLean.y)*(p-hp)+hp;                             // 身体倾向
      p=ry(uYaw)*p;
    } else { p=ry(uT*.03+rnd)*p; }
    vec3 n=normalize(o-vec3(0.,1.25,0.));
    p+=n*(.003*sin(uT*3.+rnd*40.));                                                // 闪烁
    p+=n*uLevel*.035*(.5+.5*sin(rnd*50.+uT*18.));                                  // 说话脉动
    p+=n*uListen*.012*sin(o.y*18.-uT*4.);                                          // 聆听波纹
    vec3 d=uHand-p; float dist=length(d); float f=uHandOn*exp(-dist*dist/.025);
    p+=normalize(d+1e-4)*f*.07 + n*uHandOn*.012*sin(dist*55.-uT*9.)*exp(-dist*5.);  // 手的吸引与涟漪
    vec3 cyan=vec3(0.,.9,1.), mag=vec3(1.,.17,.84);
    vC=mix(cyan,mag,step(.93,rnd)); if(part>1.5&&part<2.5) vC=vec3(1.,.7,1.)*2.;
    vC+= vec3(.6,.3,.8)*f + cyan*uLevel*.4;
    vA=(part>2.5?.3:1.)*(part<2.5?smoothstep(.76,.98,o.y):1.);
    vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
    gl_PointSize=uSize*(1.+uLevel*.4+f)*(part>1.5&&part<2.5?2.:1.)/-mv.z;
  }`,
  fragmentShader: `varying vec3 vC; varying float vA; void main(){ float d=length(gl_PointCoord-.5); float a=pow(smoothstep(.5,0.,d),1.6)*vA; gl_FragColor=vec4(vC*a,a); }` });
const pts = new THREE.Points(geo, mat); scene.add(pts);
// 背后柔光
const g = document.createElement('canvas'); g.width = g.height = 128; const gx = g.getContext('2d'), rg = gx.createRadialGradient(64, 64, 0, 64, 64, 64);
rg.addColorStop(0, 'rgba(0,229,255,.35)'); rg.addColorStop(1, 'rgba(0,229,255,0)'); gx.fillStyle = rg; gx.fillRect(0, 0, 128, 128);
const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(g), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
halo.position.set(0, 1.3, -.3); halo.scale.set(1.6, 1.6, 1); scene.add(halo);

function layout() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); cam.aspect = w / h;
  const t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), dist = Math.max(.68 / t, .44 / (t * cam.aspect)) * 1.1;
  cam.position.set(0, CY, dist); cam.lookAt(0, CY, 0); cam.updateProjectionMatrix(); }
addEventListener('resize', layout); layout();

/* ---------- 手部追踪（按需加载 MediaPipe） ---------- */
let lm = null, video = null, camOn = false;
const hand = { on: 0, tgt: V(0, CY, .3), pinch: false, lastX: 0 };
let yaw = 0, yawT = 0, palm = { t: 0, x: 0, y: 0, fired: false }, thumb = { n: 0 }, cool = 0;
const dd = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
JV.camera = async on => {
  if (!on) { camOn = false; video?.srcObject?.getTracks().forEach(t => t.stop()); video?.remove(); video = null; return; }
  if (!lm) { JV.sub('正在加载手势模型…'); const { FilesetResolver, HandLandmarker } = await import('./vendor/mp/vision_bundle.mjs');
    const fs = await FilesetResolver.forVisionTasks('./vendor/mp/wasm');
    lm = await HandLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: './vendor/mp/hand_landmarker.task', delegate: 'GPU' }, runningMode: 'VIDEO', numHands: 1 }); }
  video = Object.assign(document.createElement('video'), { id: 'cam', playsInline: true, muted: true }); document.body.append(video);
  video.srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 480, height: 360 } }); await video.play();
  camOn = true; JV.sub('我看见您的手了，先生。');
};
const ray = new THREE.Raycaster(), plane = new THREE.Plane(V(0, 0, 1), -.25), hit = V();
function track(t) {
  if (!camOn || !video || video.readyState < 2) { hand.on += (0 - hand.on) * .05; return; }
  const h = lm.detectForVideo(video, t).landmarks?.[0];
  if (!h) { hand.on += (0 - hand.on) * .08; hand.pinch = false; thumb.n = 0; palm.t = 0; return; }
  hand.on += (1 - hand.on) * .1;
  const c = h[9], nx = (1 - c.x) * 2 - 1, ny = -(c.y * 2 - 1); // 镜像
  ray.setFromCamera({ x: nx, y: ny }, cam); if (ray.ray.intersectPlane(plane, hit)) hand.tgt.copy(hit);
  const size = dd(h[0], h[9]) || .1, ext = (a, b) => dd(h[a], h[0]) > dd(h[b], h[0]) * 1.12;
  const f = [ext(8, 6), ext(12, 10), ext(16, 14), ext(20, 18)], pinchR = dd(h[4], h[8]) / size;
  // 捏合 → 转动身体（带迟滞防抖）
  if (!hand.pinch && pinchR < .28) { hand.pinch = true; hand.lastX = nx; }
  else if (hand.pinch && pinchR > .45) hand.pinch = false;
  if (hand.pinch) { yawT += (nx - hand.lastX) * 3; hand.lastX = nx; }
  if (t < cool) return;
  // 张开手掌静止 1.2 秒 → 开关聆听
  const open = f.every(Boolean) && pinchR > .6;
  if (open) { if (!palm.t || Math.hypot(nx - palm.x, ny - palm.y) > .08) Object.assign(palm, { t, x: nx, y: ny });
    else if (!palm.fired && t - palm.t > 1200) { palm.fired = true; cool = t + 2500; JV.gesture('palm'); } }
  else { palm.t = 0; palm.fired = false; }
  // 👍 保持 12 帧
  const up = !f[0] && !f[1] && !f[2] && !f[3] && (h[4].y - h[2].y) / size < -.6;
  thumb.n = up ? thumb.n + 1 : 0; if (thumb.n === 12) { cool = t + 2500; JV.gesture('thumbUp'); }
}

/* ---------- 渲染循环（自动降级） ---------- */
const sm = V(0, CY, .3); let last = performance.now(), slow = 0, head = new THREE.Vector2(), lean = new THREE.Vector2(), lv = 0, ls = 0;
function loop(t) {
  requestAnimationFrame(loop); const dt = Math.min((t - last) / 1000, .1); last = t;
  if (dt > 1 / 40) { if (++slow > 90) { slow = 0; geo.setDrawRange(0, Math.max(5000, (geo.drawRange.count === Infinity ? COUNT : geo.drawRange.count) * .7 | 0)); } } else slow = Math.max(0, slow - 1);
  track(t);
  sm.lerp(hand.tgt, .12); // 平滑
  const on = hand.on, idle = V(Math.sin(t / 3000) * .15, CY + .3 + Math.sin(t / 4100) * .05, 1);
  const look = on > .05 ? sm : idle, hx = look.x, hy = look.y - 1.68;
  head.lerp(new THREE.Vector2(Math.max(-.7, Math.min(.7, Math.atan2(hx, 1))), Math.max(-.4, Math.min(.4, -Math.atan2(hy, 1)))), .08);
  lean.lerp(new THREE.Vector2(-hx * .12 * on, .06 * on), .05);
  yaw += (yawT - yaw) * .1; if (!hand.pinch) yawT *= .995;
  const st = JV.state(); lv += (JV.level() - lv) * .2; ls += ((st === 'listen' ? 1 : 0) - ls) * .05;
  Object.assign(U.uT, { value: t / 1000 }); U.uLevel.value = lv; U.uListen.value = ls; U.uYaw.value = yaw; U.uHead.value.copy(head); U.uLean.value.copy(lean);
  U.uHand.value.copy(sm); U.uHandOn.value = on;
  halo.material.opacity = .6 + lv * .5; renderer.render(scene, cam);
}
requestAnimationFrame(loop);
