/* J.A.R.V.I.S. — 纯前端个人助手。无构建步骤。API Key 只存 localStorage。 */
'use strict';
const $ = s => document.querySelector(s);
const LS = 'jarvis.cfg', LSH = 'jarvis.hist';
const DEF = { prov: 'groq', key: '', model: '', mem: 12, wake: false, mail: '', mute: false, conv: true, voice: '', hands: false };
let cfg = Object.assign({}, DEF, JSON.parse(localStorage.getItem(LS) || '{}'));
let hist = JSON.parse(localStorage.getItem(LSH) || '[]');
const save = () => localStorage.setItem(LS, JSON.stringify(cfg));

/* ---------- AI 服务商抽象 ---------- */
const PROVIDERS = {
  groq: { name: 'Groq', model: 'openai/gpt-oss-120b', url: 'https://api.groq.com/openai/v1/chat/completions', kind: 'openai' },
  openrouter: { name: 'OpenRouter', model: 'openrouter/free', url: 'https://openrouter.ai/api/v1/chat/completions', kind: 'openai' },
  gemini: { name: 'Gemini', model: 'gemini-2.5-flash', kind: 'gemini' }
};
const SYS = `你是 J.A.R.V.I.S.（贾维斯），钢铁侠风格的私人 AI 管家，主人是 Angel（男性），称呼他“先生”或“Angel”。
风格：机智、冷幽默、简洁，默认用简体中文回答，一般不超过 3~4 句；回答会被朗读，少用 Markdown 和表格。
Angel 做交易（关注 US100 纳指、USOIL 原油），也做音乐和网页小项目。需要真正动手的编程/部署任务，提醒他说“交给编程大师”。`;

// 统一流式接口：onDelta(text) 逐段回调，返回完整文本
async function chat(messages, onDelta) {
  const p = PROVIDERS[cfg.prov], model = cfg.model || p.model;
  if (p.kind === 'openai') {
    const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.key };
    if (cfg.prov === 'openrouter') { headers['HTTP-Referer'] = location.origin; headers['X-Title'] = 'JARVIS'; }
    const r = await fetch(p.url, { method: 'POST', headers, body: JSON.stringify({ model, stream: true, messages: [{ role: 'system', content: SYS }, ...messages] }) });
    if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
    return readSSE(r, j => j.choices?.[0]?.delta?.content || '', onDelta);
  }
  // Gemini：SSE 流式
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;
  const body = { systemInstruction: { parts: [{ text: SYS }] },
    contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })) };
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.key }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
  return readSSE(r, j => (j.candidates?.[0]?.content?.parts || []).map(x => x.text || '').join(''), onDelta);
}
async function readSSE(r, pick, onDelta) {
  const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', full = '';
  for (;;) {
    const { done, value } = await rd.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n'); buf = lines.pop();
    for (const l of lines) {
      if (!l.startsWith('data:')) continue; const d = l.slice(5).trim();
      if (!d || d === '[DONE]') continue;
      try { const t = pick(JSON.parse(d)); if (t) { full += t; onDelta(t); } } catch (e) {}
    }
  }
  return full;
}

/* ---------- 日志 ---------- */
function addMsg(cls, text) { const d = document.createElement('div'); d.className = 'm ' + cls; d.textContent = text; $('#log').append(d); $('#log').scrollTop = 1e9; return d; }
const status = t => $('#status').textContent = t;

/* ---------- 语音合成 TTS ---------- */
// 浏览器在用户点击前会屏蔽声音，所以开机画面需要点 INITIALIZE 解锁
let voices = [], speaking = 0, speakPulse = 0;
const MALE = /male|daniel|ryan|george|arthur|oliver|guy|yunxi|yunyang|yunjian|kangkang|liang|男/i, FEMALE = /female|女|xiaoxiao|tingting|samantha|serena|libby|sonia|hazel|susan/i;
function loadVoices() { voices = speechSynthesis.getVoices(); fillVoiceSel(); }
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function pickVoice(text) {
  if (cfg.voice) { const v = voices.find(v => v.name === cfg.voice); if (v) return v; }
  const zh = /[\u4e00-\u9fff]/.test(text);
  const pool = voices.filter(v => zh ? /^zh/i.test(v.lang) : /^en-GB/i.test(v.lang));
  const pref = zh ? [] : [/UK English Male/i, /Daniel/i, /Ryan/i, /George/i, /Arthur/i];
  for (const p of pref) { const v = pool.find(v => p.test(v.name)); if (v) return v; }
  return pool.find(v => MALE.test(v.name) && !FEMALE.test(v.name)) || pool.find(v => /zh-CN/i.test(v.lang)) || pool.find(v => !FEMALE.test(v.name)) || pool[0] || null;
}
function chime() { // 简单的科幻提示音
  try { const ac = audioCtx(), o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(1320, ac.currentTime); o.frequency.exponentialRampToValueAtTime(880, ac.currentTime + 0.12);
    g.gain.setValueAtTime(0.08, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.18); o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.2); } catch (e) {}
}
function speak(t, force) {
  if ((cfg.mute && !force) || !('speechSynthesis' in window) || !t) { resumeListen(); return; }
  speechSynthesis.cancel(); pauseListen(); chime();
  const u = new SpeechSynthesisUtterance(t.replace(/[*#`>|_]/g, ''));
  const v = pickVoice(t); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = /[\u4e00-\u9fff]/.test(t) ? 'zh-CN' : 'en-GB';
  u.pitch = 0.9; u.rate = 1.0;
  u.onstart = () => speaking = 1;
  u.onend = u.onerror = () => { speaking = 0; setTimeout(resumeListen, 350); };
  u.onboundary = () => speakPulse = 1;
  setTimeout(() => speechSynthesis.speak(u), 150);
}
function fillVoiceSel() {
  const sel = $('#sVoice'); if (!sel) return;
  sel.innerHTML = '<option value="">自动（英文英式男声 / 中文男声）</option>' + voices.map(v => `<option value="${v.name}">${v.name} (${v.lang})</option>`).join('');
  sel.value = cfg.voice || '';
}

/* ---------- 本地指令（不走 LLM） ---------- */
const LINKS = [
  ['和弦换调', 'https://angeltsien.github.io/chord-transposer/', /和弦|换调/],
  ['交易日志', 'https://angel-trade-journal.pages.dev', /交易日志(?!.*(单机|2))/],
  ['交易日志单机版', 'https://angeltsien.github.io/trade-journal/', /单机/],
  ['交易日志 2.0', 'https://angeltsien.github.io/trade-journal-2/', /2\.0|二点零|量子/],
  ['赛博粒子', 'https://angeltsien.github.io/cyber-particles/', /粒子/],
  ['Neon Arcade', 'https://angeltsien.github.io/neon-arcade/', /游戏|arcade|街机/i]
];
let weatherText = '天气数据还没加载好，先生。';
function local(q) {
  if (/^(打开|开启|open)/i.test(q) || /打开/.test(q)) {
    const l = LINKS.find(x => x[2].test(q.replace(/打开/, '')));
    if (l) { openHolo(l[1], l[0]); return `正在为您打开「${l[0]}」，先生。`; }
  }
  if (/几点|时间|what time/i.test(q)) return `现在是 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}，${new Date().toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' })}。`;
  if (/天气|weather/i.test(q)) return weatherText;
  if (/交给编程大师/.test(q)) { handoff(q.replace(/.*交给编程大师[:：,，\s]*/, '') || lastUser); return '已为您打开邮件草稿，确认无误后由您亲自点发送，先生。'; }
  if (/^(静音|闭嘴|mute)/i.test(q)) { setMute(true); return '已静音。'; }
  return null;
}
let lastUser = '';
function handoff(task) {
  const subject = encodeURIComponent('[JARVIS 任务] ' + (task || '').slice(0, 40));
  const body = encodeURIComponent('来自 Jarvis 的任务交接：\n\n' + (task || '（请填写任务）') + '\n\n— Angel');
  location.href = `mailto:${encodeURIComponent(cfg.mail || '')}?subject=${subject}&body=${body}`; // 只打开草稿，不会自动发送
}

/* ---------- 处理输入 ---------- */
let busy = false;
async function handle(q) {
  q = q.trim(); if (!q || busy) return;
  addMsg('u', q);
  const l = local(q); lastUser = q;
  if (l) { addMsg('j', l); speak(l); return; }
  pauseListen();
  if (!cfg.key) { const t = '先生，我的“大脑”还没接上。请点右上角 ⚙️ 填入免费的 API Key（推荐 Groq），本地指令照常可用：打开交易日志、现在几点、天气。'; addMsg('j', t); speak(t); return; }
  busy = true; status('思考中…'); const el = addMsg('j', '');
  hist.push({ role: 'user', content: q });
  try {
    const full = await chat(hist.slice(-cfg.mem), d => { el.textContent += d; $('#log').scrollTop = 1e9; });
    hist.push({ role: 'assistant', content: full }); hist = hist.slice(-40); localStorage.setItem(LSH, JSON.stringify(hist));
    speak(full);
  } catch (e) { hist.pop(); el.textContent = '连接 AI 失败：' + e.message + '（检查 Key/网络；中国大陆可能需要代理）'; resumeListen(); }
  busy = false; status(listenWanted() ? '聆听中…' : '待命');
}

/* ---------- 语音识别：对讲 / 免按键对话 / 唤醒词 ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, ptt = false, awake = false, recOn = false, paused = false, silTimer = 0, pending = '';
const listenWanted = () => ptt || cfg.conv || cfg.wake;
function send(text) {
  text = text.trim(); pending = ''; clearTimeout(silTimer); $('#txt').value = ''; if (!text) return;
  if (cfg.conv || ptt) return handle(text);
  const m = text.match(/(jarvis|贾维斯|加维斯)[，,。\s]*(.*)/i); // 仅唤醒词模式
  if (m) { if (m[2]) handle(m[2]); else { awake = true; speak('在，先生。'); } }
  else if (awake) { awake = false; handle(text); }
}
function setupRec() {
  if (!SR) return;
  rec = new SR(); rec.lang = 'zh-CN'; rec.interimResults = true; rec.continuous = true;
  rec.onstart = () => recOn = true;
  rec.onresult = e => {
    if (paused) return;
    let fin = '', tmp = '';
    for (let i = e.resultIndex; i < e.results.length; i++) (e.results[i].isFinal ? (fin += e.results[i][0].transcript) : (tmp += e.results[i][0].transcript));
    $('#txt').value = pending + fin + tmp; pending += fin;
    clearTimeout(silTimer);
    // 停顿约 1.2 秒就自动发送（不用按发送键）
    if (!ptt) silTimer = setTimeout(() => send(pending + tmp), fin && !tmp ? 700 : 1200);
  };
  rec.onend = () => { recOn = false; if (listenWanted() && !paused) setTimeout(startRec, 250); };
  rec.onerror = e => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { addMsg('s', '麦克风权限被拒绝，请在浏览器设置里允许，然后刷新。'); cfg.conv = cfg.wake = ptt = false; updConvBtn(); }
  };
}
function startRec() { if (!rec) return; if (recOn || paused) return; try { rec.start(); } catch (e) {} startMic(); }
function stopRec() { clearTimeout(silTimer); if (rec) try { rec.stop(); } catch (e) {} }
function pauseListen() { paused = true; clearTimeout(silTimer); if (rec && recOn) try { rec.abort(); } catch (e) {} }   // 说话/思考时暂停，避免听到自己
function resumeListen() { if (busy || speaking) return; paused = false; if (listenWanted()) { startRec(); status('聆听中…'); } }
function updConvBtn() { const b = $('#convBtn'); if (b) { b.textContent = cfg.conv ? '🟢 对话中' : '⚪ 免按键'; b.classList.toggle('on', cfg.conv); } }

/* ---------- 麦克风分析器（驱动反应堆脉冲） ---------- */
let analyser = null, abuf, actx = null;
function audioCtx() { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); return actx; }
async function startMic() {
  if (analyser || !navigator.mediaDevices) return;
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ac = audioCtx();
    analyser = ac.createAnalyser(); analyser.fftSize = 256; abuf = new Uint8Array(analyser.frequencyBinCount);
    ac.createMediaStreamSource(s).connect(analyser);
  } catch (e) {}
}
function level() {
  let v = 0;
  if (analyser && listenWanted() && !paused) { analyser.getByteFrequencyData(abuf); v = abuf.reduce((a, b) => a + b, 0) / abuf.length / 128; }
  if (speaking) { speakPulse *= 0.9; v = Math.max(v, 0.35 + 0.35 * Math.abs(Math.sin(performance.now() / 90)) + speakPulse * 0.4); }
  if (busy) v = Math.max(v, 0.25 + 0.15 * Math.sin(performance.now() / 150));
  return Math.min(v, 1.5);
}

/* ---------- 方舟反应堆动画 ---------- */
const cv = $('#reactor'), cx = cv.getContext('2d'); let lv = 0;
// 给 3D 核心（core3d.js）用的接口
window.JV = { rot: { x: 0, y: 0, vx: 0, vy: 0 }, msg: t => addMsg('s', t), openHolo: (u, t) => openHolo(u, t), level, state: () => busy ? 'busy' : speaking ? 'speak' : (listenWanted() && !paused) ? 'listen' : 'idle' };
function draw(t) {
  const w = cv.width = cv.clientWidth * devicePixelRatio, h = cv.height = cv.clientHeight * devicePixelRatio;
  const R = Math.min(w, h) * 0.34, X = w / 2, Y = h / 2; lv += (level() - lv) * 0.2;
  cx.clearRect(0, 0, w, h); cx.lineCap = 'round';
  if (document.body.classList.contains('gl3d')) { cx.textAlign = 'center'; cx.font = `${12 * devicePixelRatio}px Orbitron`; cx.fillStyle = listenWanted() && !paused ? '#39ff88' : '#00e5ff'; cx.fillText(busy ? 'PROCESSING' : speaking ? 'SPEAKING' : (listenWanted() && !paused ? '● LISTENING' : 'STANDBY'), X, h - 14 * devicePixelRatio); requestAnimationFrame(draw); return; }
  const glow = (c, b) => { cx.shadowColor = c; cx.shadowBlur = b * devicePixelRatio; cx.strokeStyle = c; };
  // 外圈刻度
  glow('#00e5ff', 8); cx.lineWidth = 1.5 * devicePixelRatio;
  for (let i = 0; i < 120; i++) { const a = i / 120 * 6.283 + t / 9000, l = i % 10 ? 6 : 16;
    cx.globalAlpha = .5; cx.beginPath(); cx.moveTo(X + Math.cos(a) * R * 1.12, Y + Math.sin(a) * R * 1.12); cx.lineTo(X + Math.cos(a) * (R * 1.12 + l), Y + Math.sin(a) * (R * 1.12 + l)); cx.stroke(); }
  cx.globalAlpha = 1;
  // 旋转弧段
  const arcs = [[1.0, 1, '#00e5ff', 4, 6], [0.86, -1.6, '#ff9a1f', 3, 3], [0.72, 2.3, '#00e5ff', 2, 8], [1.22, -0.5, '#ff9a1f', 1.5, 2]];
  for (const [rr, sp, c, lw, n] of arcs) { glow(c, 14); cx.lineWidth = lw * devicePixelRatio;
    for (let i = 0; i < n; i++) { const a0 = t / 1000 * sp * 0.4 + i * 6.283 / n; cx.beginPath(); cx.arc(X, Y, R * rr * (1 + lv * 0.06), a0, a0 + 6.283 / n * 0.6); cx.stroke(); } }
  // 声波环
  glow('#00e5ff', 20); cx.lineWidth = 2 * devicePixelRatio; cx.beginPath();
  for (let i = 0; i <= 180; i++) { const a = i / 180 * 6.283, f = abuf && analyser ? abuf[i % abuf.length] / 255 : 0;
    const r = R * 0.55 * (1 + lv * 0.25 * (0.6 + 0.4 * Math.sin(a * 8 + t / 120)) + f * lv * 0.2);
    i ? cx.lineTo(X + Math.cos(a) * r, Y + Math.sin(a) * r) : cx.moveTo(X + Math.cos(a) * r, Y + Math.sin(a) * r); }
  cx.closePath(); cx.stroke();
  if (listenWanted() && !paused) { glow('#39ff88', 18); cx.lineWidth = 2 * devicePixelRatio; cx.globalAlpha = 0.5 + 0.5 * Math.sin(t / 250); cx.beginPath(); cx.arc(X, Y, R * 1.3, 0, 6.283); cx.stroke(); cx.globalAlpha = 1; }
  // 三角核心
  glow('#ff9a1f', 25); cx.lineWidth = 3 * devicePixelRatio; cx.beginPath();
  for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * 2.094 - t / 4000; const r = R * 0.3; i ? cx.lineTo(X + Math.cos(a) * r, Y + Math.sin(a) * r) : cx.moveTo(X + Math.cos(a) * r, Y + Math.sin(a) * r); }
  cx.closePath(); cx.stroke();
  const g = cx.createRadialGradient(X, Y, 0, X, Y, R * 0.45); g.addColorStop(0, `rgba(220,255,255,${0.9})`); g.addColorStop(0.3, `rgba(0,229,255,${0.35 + lv * 0.4})`); g.addColorStop(1, 'rgba(0,229,255,0)');
  cx.shadowBlur = 0; cx.fillStyle = g; cx.beginPath(); cx.arc(X, Y, R * 0.45 * (1 + lv * 0.15), 0, 6.283); cx.fill();
  cx.fillStyle = listenWanted() && !paused ? '#39ff88' : '#00e5ff'; cx.font = `${12 * devicePixelRatio}px Orbitron`; cx.textAlign = 'center'; cx.globalAlpha = .8;
  cx.fillText(busy ? 'PROCESSING' : speaking ? 'SPEAKING' : (listenWanted() && !paused ? '● LISTENING' : 'STANDBY'), X, Y + R * 1.3 + 20 * devicePixelRatio); cx.globalAlpha = 1;
  requestAnimationFrame(draw);
}

/* ---------- 面板：时钟 / 天气 / 链接 / 行情 ---------- */
function tick() { const d = new Date(); $('#clock').textContent = d.toLocaleTimeString('zh-CN', { hour12: false }); $('#date').textContent = d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }); }
const WMO = { 0: '晴', 1: '大致晴', 2: '多云', 3: '阴', 45: '雾', 48: '雾凇', 51: '小毛毛雨', 53: '毛毛雨', 55: '大毛毛雨', 61: '小雨', 63: '中雨', 65: '大雨', 71: '小雪', 73: '中雪', 75: '大雪', 80: '阵雨', 81: '阵雨', 82: '强阵雨', 95: '雷暴', 96: '雷暴冰雹', 99: '强雷暴' };
async function weather(lat = 44.4949, lon = 11.3426, name = 'Bologna') {
  try {
    const j = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`)).json();
    const c = j.current, d = WMO[c.weather_code] || '—';
    $('#weather').innerHTML = `<div style="font:800 26px Orbitron">${Math.round(c.temperature_2m)}°C</div>${name} · ${d}<br>湿度 ${c.relative_humidity_2m}% · 风 ${c.wind_speed_10m} km/h<br>今日 ${Math.round(j.daily.temperature_2m_min[0])}° ~ ${Math.round(j.daily.temperature_2m_max[0])}°`;
    weatherText = `${name}现在${d}，${Math.round(c.temperature_2m)} 度，今天 ${Math.round(j.daily.temperature_2m_min[0])} 到 ${Math.round(j.daily.temperature_2m_max[0])} 度，先生。`;
  } catch (e) { $('#weather').textContent = '天气获取失败'; }
}
function tv() {
  document.querySelectorAll('.tv').forEach(el => {
    const s = document.createElement('script'); s.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js'; s.async = true;
    s.innerHTML = JSON.stringify({ symbol: el.dataset.sym, width: '100%', height: 150, locale: 'zh_CN', dateRange: '1D', colorTheme: 'dark', isTransparent: true, autosize: true });
    const w = document.createElement('div'); w.className = 'tradingview-widget-container'; w.style.height = '150px'; w.innerHTML = '<div class="tradingview-widget-container__widget"></div>'; w.append(s); el.append(w);
  });
}

/* ---------- 页内全息窗口（不离开 JARVIS） ---------- */
let holoZ = 70;
function openHolo(url, title) {
  const li = LINKS.findIndex(l => l[1] === url); if (li >= 0) lastProj = li;
  const w = document.createElement('div'); w.className = 'holo'; w.style.zIndex = ++holoZ;
  const off = document.querySelectorAll('.holo').length * 24; w.style.translate = `${off}px ${off}px`;
  w.innerHTML = `<div class="holo-bar"><span>◈ ${title}</span><a href="${url}" target="_blank" rel="noopener" title="新标签打开">↗</a><button title="关闭">✕</button></div><iframe src="${url}" allow="camera; microphone; fullscreen; autoplay" loading="lazy"></iframe>`;
  w.querySelector('button').onclick = () => w.remove();
  w.addEventListener('pointerdown', () => w.style.zIndex = ++holoZ);
  // 鼠标/手指拖动标题栏
  const bar = w.querySelector('.holo-bar'); bar.addEventListener('pointerdown', e => { if (e.target.closest('button,a')) return;
    const m = (w.style.translate || '0px 0px').split(' ').map(parseFloat), ox = (m[0] || 0) - e.clientX, oy = (m[1] || 0) - e.clientY; bar.setPointerCapture(e.pointerId);
    bar.onpointermove = ev => w.style.translate = `${ev.clientX + ox}px ${ev.clientY + oy}px`; bar.onpointerup = () => bar.onpointermove = null; });
  document.body.append(w);
}

/* ---------- 手势识别 → 动作 ---------- */
const G = { thumbUp: '👍 确认', thumbDown: '👎 取消', fist: '✊ 静音', palm: '✋ 切换聆听', victory: '✌️ 状态报告', ok: '👌 打开项目', wave: '👋 打招呼', swipeLeft: '👈 上一个', swipeRight: '👉 下一个', pointUp: '☝️ 向上滚动' };
let lastProj = 0, toastT = 0;
function toast(t) { const el = $('#gToast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 1600); }
JV.gestureLabel = toast;
function topHolo() { return [...document.querySelectorAll('.holo')].sort((x, y) => y.style.zIndex - x.style.zIndex)[0]; }
function cycle(step) { const h = topHolo(); lastProj = ((h ? lastProj : lastProj - step) + step + LINKS.length) % LINKS.length; h?.remove(); openHolo(LINKS[lastProj][1], LINKS[lastProj][0]); }
JV.gesture = g => {
  toast(G[g] || g);
  const say = t => { addMsg('j', t); speak(t); };
  switch (g) {
    case 'thumbUp': say('收到，先生。'); break;
    case 'thumbDown': { const h = topHolo(); if (h) { h.remove(); say('已关闭。'); } else { speechSynthesis.cancel(); say('已取消。'); } break; }
    case 'fist': speechSynthesis.cancel(); speaking = 0; setMute(!cfg.mute); addMsg('s', cfg.mute ? '已静音' : '已取消静音'); if (!cfg.mute) speak('声音已恢复。'); else resumeListen(); break;
    case 'palm': $('#convBtn').click(); say(cfg.conv ? '我在听，先生。' : '暂停聆听。'); break;
    case 'victory': say(local('现在几点') + ' ' + weatherText); break;
    case 'ok': openHolo(LINKS[lastProj][1], LINKS[lastProj][0]); say('为您打开「' + LINKS[lastProj][0] + '」。'); break;
    case 'wave': say('Hello, sir. 很高兴见到您。'); break;
    case 'swipeLeft': cycle(-1); break;
    case 'swipeRight': cycle(1); break;
    case 'pointUp': $('#log').scrollBy({ top: -120, behavior: 'smooth' }); break;
  }
};

/* ---------- 手势 ---------- */
async function setHands(v) {
  cfg.hands = v; save(); const b = $('#handBtn'); b.classList.toggle('on', v);
  if (!JV.hands) { if (v) addMsg('s', '手势模块还在加载，请稍后再试'); return; }
  try { v ? await JV.hands.start() : JV.hands.stop(); } catch (e) { addMsg('s', '摄像头不可用：' + e.message); cfg.hands = false; save(); b.classList.remove('on'); }
}

/* ---------- 设置 ---------- */
function setMute(m) { cfg.mute = m; save(); $('#muteBtn').textContent = m ? '🔇' : '🔊'; if (m && window.speechSynthesis) speechSynthesis.cancel(); }
function openSet() { $('#sProv').value = cfg.prov; $('#sKey').value = cfg.key; $('#sMem').value = cfg.mem; $('#sWake').checked = cfg.wake; $('#sMail').value = cfg.mail; fillVoiceSel(); updModel(); $('#settings').hidden = false; }
function updModel() { $('#sModel').placeholder = '默认：' + PROVIDERS[$('#sProv').value].model; $('#sModel').value = $('#sProv').value === cfg.prov ? cfg.model : ''; }

/* ---------- 启动 ---------- */
function boot() {
  const lines = ['> 初始化核心系统…', '> 方舟反应堆输出 3 GJ/s … OK', '> 载入语音模块 zh-CN … ' + (SR ? 'OK' : '不支持，改用文字'), '> 连接 AI 中枢 [' + PROVIDERS[cfg.prov].name + '] … ' + (cfg.key ? 'OK' : '未配置 Key'), '> 接入市场数据流 … OK', '> 所有系统就绪'];
  let i = 0; const iv = setInterval(() => { $('#bootlog').textContent += lines[i++] + '\n'; if (i >= lines.length) { clearInterval(iv); $('#bootTitle').classList.add('show'); $('#initBtn').hidden = false; } }, 260);
}
function greet() {
  const h = new Date().getHours(), g = h < 5 ? '夜深了' : h < 12 ? '早上好' : h < 18 ? '下午好' : '晚上好';
  const t = `${g}，先生。JARVIS 已上线。` + (cfg.key ? '有什么可以为您效劳？' : '目前未连接 AI，请在 ⚙️ 设置里填入免费 API Key；本地指令可用。');
  addMsg('j', t); speak(t, true);
}
function initialize() { // 用户点击：解锁声音 + 麦克风
  try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) {}
  audioCtx(); loadVoices && 'speechSynthesis' in window && loadVoices();
  $('#boot').classList.add('done');
  if (!SR) { cfg.conv = false; addMsg('s', '此浏览器不支持语音识别（Firefox / 部分 iOS），请打字，回车发送。建议用 Chrome 或 Edge。'); }
  else { cfg.conv = true; save(); }
  updConvBtn(); startMic(); greet(); if (cfg.hands) setHands(true);
}
window.addEventListener('DOMContentLoaded', () => {
  $('#links').innerHTML = LINKS.map(l => `<a href="${l[1]}" target="_blank" rel="noopener">▸ ${l[0]}</a>`).join('');
  tick(); setInterval(tick, 1000); weather(); tv(); setupRec(); setMute(cfg.mute);
  if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => weather(p.coords.latitude, p.coords.longitude, '当前位置'), () => {}, { timeout: 8000 });
  hist.slice(-6).forEach(m => addMsg(m.role === 'user' ? 'u' : 'j', m.content)); if (hist.length) addMsg('s', '—— 以上为历史记忆 ——');
  requestAnimationFrame(draw); boot();
  $('#sendBtn').onclick = () => { handle($('#txt').value); $('#txt').value = ''; };
  $('#txt').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(silTimer); pending = ''; $('#sendBtn').click(); } };
  const mic = $('#micBtn');
  const down = e => { e.preventDefault(); ptt = true; mic.classList.add('on'); status('聆听中…'); if (window.speechSynthesis) speechSynthesis.cancel(); speaking = 0; paused = false; startRec(); };
  const up = () => { if (!ptt) return; ptt = false; mic.classList.remove('on'); setTimeout(() => send(pending || $('#txt').value), 600); if (!listenWanted()) stopRec(); };
  mic.addEventListener('pointerdown', down); mic.addEventListener('pointerup', up); mic.addEventListener('pointerleave', up);
  $('#muteBtn').onclick = () => setMute(!cfg.mute);
  $('#handoffBtn').onclick = () => { const t = $('#txt').value.trim() || prompt('要交给编程大师的任务：', lastUser) || ''; if (t) handoff(t); };
  $('#initBtn').onclick = initialize;
  $('#links').addEventListener('click', e => { const a = e.target.closest('a'); if (a) { e.preventDefault(); openHolo(a.href, a.textContent.replace('▸', '').trim()); } });
  $('#handBtn').onclick = () => setHands(!cfg.hands);
  $('#helpBtn').onclick = () => $('#help').hidden = !$('#help').hidden; $('#help').onclick = () => $('#help').hidden = true;
  $('#sHands').checked = cfg.hands; $('#sHands').onchange = e => setHands(e.target.checked);
  $('#convBtn').onclick = () => { cfg.conv = !cfg.conv; save(); updConvBtn(); if (cfg.conv) { if (!SR) return addMsg('s', '此浏览器不支持语音识别'); paused = false; startRec(); status('聆听中…'); } else if (!cfg.wake) { stopRec(); status('待命'); } };
  $('#sTest').onclick = () => { cfg.voice = $('#sVoice').value; speak('Good evening, sir. 先生，我是 JARVIS，声音测试正常。', true); };
  $('#setBtn').onclick = openSet; $('#sClose').onclick = () => $('#settings').hidden = true; $('#sProv').onchange = updModel;
  $('#sClear').onclick = () => { hist = []; localStorage.removeItem(LSH); $('#log').innerHTML = ''; addMsg('s', '对话记忆已清空'); };
  $('#sSave').onclick = () => {
    Object.assign(cfg, { prov: $('#sProv').value, key: $('#sKey').value.trim(), model: $('#sModel').value.trim(), mem: Math.max(2, +$('#sMem').value || 12), wake: $('#sWake').checked, mail: $('#sMail').value.trim(), voice: $('#sVoice').value });
    save(); $('#settings').hidden = true; addMsg('s', `已保存：${PROVIDERS[cfg.prov].name} · ${cfg.model || PROVIDERS[cfg.prov].model}` + (cfg.wake ? ' · 唤醒词监听开启' : ''));
    if (listenWanted()) { paused = false; startRec(); } else stopRec();
  };
});
