// 手势控制：食指光标 / 捏合拖动 / 快速捏合=点击 / 张开手掌=旋转 3D 核心（MediaPipe 本地 vendor）
import { FilesetResolver, HandLandmarker } from './vendor/mp/vision_bundle.mjs';
const JV = window.JV; let lm = null, video = null, on = false, raf = 0;
const cur = document.createElement('div'); cur.id = 'handCursor'; document.body.append(cur);
let sx = 0, sy = 0, pinch = false, pStart = 0, pX = 0, pY = 0, drag = null, dOX = 0, dOY = 0, palmX = null, palmY = null;
const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
async function start() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('此浏览器不支持摄像头');
  JV.msg('正在加载手势模型…');
  if (!lm) { const fs = await FilesetResolver.forVisionTasks('./vendor/mp/wasm');
    lm = await HandLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: './vendor/mp/hand_landmarker.task', delegate: 'GPU' }, runningMode: 'VIDEO', numHands: 2 }); }
  video = document.createElement('video'); video.id = 'handCam'; video.playsInline = true; video.muted = true; document.body.append(video);
  video.srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } }); await video.play();
  on = true; cur.style.display = 'block'; JV.msg('手势已开启：食指移动光标，捏合拖动，快速捏一下=点击，张开手掌左右移动=旋转核心'); loop();
}
function stop() { on = false; cancelAnimationFrame(raf); cur.style.display = 'none'; if (video) { video.srcObject?.getTracks().forEach(t => t.stop()); video.remove(); video = null; } JV.rot.vx = JV.rot.vy = 0; }
function loop() {
  if (!on) return; raf = requestAnimationFrame(loop);
  if (video.readyState < 2) return;
  const r = lm.detectForVideo(video, performance.now()), h = r.landmarks?.[0];
  recognize(r.landmarks || [], performance.now());
  if (!h) { cur.classList.add('lost'); return; } cur.classList.remove('lost');
  const size = d(h[0], h[9]) || .1, tip = h[8];
  const x = (1 - tip.x) * innerWidth, y = tip.y * innerHeight; // 镜像
  sx += (x - sx) * .35; sy += (y - sy) * .35; cur.style.transform = `translate(${sx}px,${sy}px)`;
  const isPinch = d(h[4], h[8]) / size < (pinch ? .45 : .32); // 迟滞防抖
  const open = [8, 12, 16, 20].every(i => d(h[i], h[0]) / size > 1.6) && !isPinch;
  // 张开手掌 → 旋转核心
  if (open) { const px = 1 - h[9].x, py = h[9].y; if (palmX != null) { JV.rot.vy += (px - palmX) * 6; JV.rot.vx += (py - palmY) * 6; } palmX = px; palmY = py; cur.classList.add('palm'); }
  else { palmX = null; cur.classList.remove('palm'); }
  if (curPose === 'ok') return; // OK 手势时不触发捏合
  if (isPinch && !pinch) { pinch = true; pStart = performance.now(); pX = sx; pY = sy; cur.classList.add('pinch');
    const el = under(sx, sy), t = el?.closest('.holo, aside .panel');
    if (t) { drag = t; const m = (t.style.translate || '0px 0px').split(' ').map(parseFloat); dOX = (m[0] || 0) - sx; dOY = (m[1] || 0) - sy; } }
  else if (isPinch && drag && Math.hypot(sx - pX, sy - pY) > 25) { drag.style.translate = `${sx + dOX}px ${sy + dOY}px`; drag.classList.add('dragging'); }
  else if (!isPinch && pinch) { pinch = false; cur.classList.remove('pinch');
    if (performance.now() - pStart < 450 && Math.hypot(sx - pX, sy - pY) < 25) { const el = under(sx, sy); el?.click?.(); el?.focus?.(); cur.classList.add('click'); setTimeout(() => cur.classList.remove('click'), 250); }
    drag?.classList.remove('dragging'); drag = null; }
}
function under(x, y) { cur.style.display = 'none'; const el = document.elementFromPoint(x, y); cur.style.display = 'block'; return el; }
/* ===== 手势识别层（规则：手指伸直/弯曲 + 运动轨迹） ===== */
let curPose = '', poseN = 0, firedPose = '', lastFire = {}, hist = [], palmHold = 0, twoD = null;
function fingers(h) { // 伸直判定：指尖离手腕比第二关节更远
  const W = h[0], ext = (t, p) => d(h[t], W) > d(h[p], W) * 1.12;
  const thumb = d(h[4], h[17]) > d(h[3], h[17]) * 1.05 && d(h[4], h[5]) > d(h[0], h[5]) * .45;
  return { thumb, index: ext(8, 6), middle: ext(12, 10), ring: ext(16, 14), pinky: ext(20, 18) };
}
function pose(h) {
  const f = fingers(h), size = d(h[0], h[9]), curled = !f.index && !f.middle && !f.ring && !f.pinky;
  if (d(h[4], h[8]) / size < .3 && f.middle && f.ring && f.pinky) return 'ok';
  if (curled && f.thumb) { const dy = (h[4].y - h[2].y) / size; if (dy < -.5) return 'thumbUp'; if (dy > .5) return 'thumbDown'; }
  if (curled && !f.thumb) return 'fist';
  if (f.index && f.middle && !f.ring && !f.pinky) return 'victory';
  if (f.index && !f.middle && !f.ring && !f.pinky && h[8].y < h[6].y - .05) return 'pointUp';
  if (f.index && f.middle && f.ring && f.pinky) return 'palm';
  return '';
}
function fire(g) { const t = performance.now(); if (t - (lastFire[g] || 0) < 1500) return; lastFire[g] = t; JV.gesture?.(g); }
function recognize(hands, t) {
  // 双手：张开/靠拢 → 缩放 3D 核心
  if (hands.length === 2) { const dd = d(hands[0][8], hands[1][8]); if (twoD != null) JV.zoom = Math.max(.5, Math.min(2.2, (JV.zoom || 1) * (1 + (dd - twoD) * 2))); twoD = dd; JV.gestureLabel?.('🙌 双手缩放'); return; }
  twoD = null; const h = hands[0]; if (!h) { curPose = ''; poseN = 0; hist = []; return; }
  const p = pose(h); if (p === curPose) poseN++; else { curPose = p; poseN = 0; firedPose = ''; palmHold = t; }
  // 静态手势：连续 8 帧稳定才触发（防抖）
  if (poseN === 8 && p && p !== 'palm' && p !== 'fist' && firedPose !== p) { firedPose = p; fire(p); }
  if (p === 'fist' && poseN === 20) fire('fist'); // 握拳需要保持
  // 动态手势：手掌横向轨迹
  const cx = 1 - h[9].x; hist.push([t, cx]); hist = hist.filter(e => t - e[0] < 1000);
  if (p === 'palm' && hist.length > 6) {
    const recent = hist.filter(e => t - e[0] < 280), dx = recent.length > 1 ? recent.at(-1)[1] - recent[0][1] : 0;
    if (Math.abs(dx) > .28) { fire(dx > 0 ? 'swipeRight' : 'swipeLeft'); hist = []; return; }
    let rev = 0, dir = 0; for (let i = 2; i < hist.length; i++) { const s = Math.sign(hist[i][1] - hist[i - 2][1]); if (s && Math.abs(hist[i][1] - hist[i - 2][1]) > .015) { if (dir && s !== dir) rev++; dir = s; } }
    if (rev >= 3) { fire('wave'); hist = []; return; }
    const span = Math.max(...hist.map(e => e[1])) - Math.min(...hist.map(e => e[1]));
    if (t - palmHold > 1000 && span < .04 && firedPose !== 'palm') { firedPose = 'palm'; fire('palm'); }
  }
}

JV.hands = { start, stop, get on() { return on; } };
window.dispatchEvent(new Event('hands-ready'));
