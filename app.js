/* J.A.R.V.I.S. — 极简版：粒子人形 + 语音对话。无构建步骤，API Key 只存 localStorage。 */
'use strict';
const $ = s => document.querySelector(s);
const LS = 'jarvis.cfg', LSH = 'jarvis.hist';
let cfg = Object.assign({ prov: 'groq', key: '', model: '', mem: 12, mail: '', voice: '', conv: true, cam: false }, JSON.parse(localStorage.getItem(LS) || '{}'));
let hist = JSON.parse(localStorage.getItem(LSH) || '[]');
const save = () => localStorage.setItem(LS, JSON.stringify(cfg));

/* ---------- AI 服务商 ---------- */
const PROVIDERS = {
  groq: { name: 'Groq', model: 'openai/gpt-oss-120b', url: 'https://api.groq.com/openai/v1/chat/completions' },
  openrouter: { name: 'OpenRouter', model: 'openrouter/free', url: 'https://openrouter.ai/api/v1/chat/completions' },
  gemini: { name: 'Gemini', model: 'gemini-2.5-flash' }
};
const SYS = `你是 J.A.R.V.I.S.（贾维斯），钢铁侠风格的私人 AI 管家，主人是 Angel（男性），称呼他“先生”或“Angel”。
机智、冷幽默、非常简洁：默认简体中文，1~3 句。回答会被朗读，不要用 Markdown、列表或表情。
需要真正动手的编程/部署任务，提醒他说“交给编程大师”。`;
async function chat(messages, onDelta) {
  const p = PROVIDERS[cfg.prov], model = cfg.model || p.model; let r;
  if (cfg.prov === 'gemini') {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.key },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYS }] }, contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })) }) });
  } else {
    const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.key };
    if (cfg.prov === 'openrouter') { headers['HTTP-Referer'] = location.origin; headers['X-Title'] = 'JARVIS'; }
    r = await fetch(p.url, { method: 'POST', headers, body: JSON.stringify({ model, stream: true, messages: [{ role: 'system', content: SYS }, ...messages] }) });
  }
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 120));
  const pick = cfg.prov === 'gemini' ? j => (j.candidates?.[0]?.content?.parts || []).map(x => x.text || '').join('') : j => j.choices?.[0]?.delta?.content || '';
  const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', full = '';
  for (;;) { const { done, value } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n'); buf = lines.pop();
    for (const l of lines) { const d = l.startsWith('data:') ? l.slice(5).trim() : ''; if (!d || d === '[DONE]') continue;
      try { const t = pick(JSON.parse(d)); if (t) { full += t; onDelta(full); } } catch (e) {} } }
  return full;
}

/* ---------- 字幕 + 状态点 ---------- */
let subT = 0;
function sub(text, me) { const el = $('#sub'); el.textContent = text; el.classList.toggle('me', !!me); el.classList.add('show'); clearTimeout(subT); subT = setTimeout(() => el.classList.remove('show'), me ? 4000 : 7000); }
function state() { return busy ? 'busy' : speaking ? 'speak' : (cfg.conv && !paused && recOn) ? 'listen' : 'idle'; }
setInterval(() => $('#dot').className = state(), 200);

/* ---------- 语音合成 ---------- */
let voices = [], speaking = 0, speakPulse = 0;
const FEMALE = /female|女|xiaoxiao|tingting|samantha|serena|libby|sonia|hazel|susan/i;
function loadVoices() { voices = speechSynthesis.getVoices(); const sel = $('#sVoice'); if (!sel) return;
  sel.innerHTML = '<option value="">自动（英文英式男声 / 中文男声）</option>' + voices.map(v => `<option value="${v.name}">${v.name} (${v.lang})</option>`).join(''); sel.value = cfg.voice; }
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function pickVoice(t) {
  if (cfg.voice) { const v = voices.find(v => v.name === cfg.voice); if (v) return v; }
  const zh = /[\u4e00-\u9fff]/.test(t), pool = voices.filter(v => zh ? /^zh/i.test(v.lang) : /^en-GB/i.test(v.lang));
  if (!zh) for (const p of [/UK English Male/i, /Daniel/i, /Ryan/i, /George/i, /Arthur/i]) { const v = pool.find(v => p.test(v.name)); if (v) return v; }
  return pool.find(v => /male|yunxi|yunyang|yunjian|kangkang|男/i.test(v.name) && !FEMALE.test(v.name)) || pool.find(v => !FEMALE.test(v.name)) || pool[0] || null;
}
function speak(t) {
  if (!('speechSynthesis' in window) || !t) return resumeListen();
  speechSynthesis.cancel(); pauseListen();
  const u = new SpeechSynthesisUtterance(t), v = pickVoice(t);
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = /[\u4e00-\u9fff]/.test(t) ? 'zh-CN' : 'en-GB';
  u.pitch = 0.9; u.rate = 1.0;
  u.onstart = () => speaking = 1; u.onboundary = () => speakPulse = 1;
  u.onend = u.onerror = () => { speaking = 0; setTimeout(resumeListen, 350); };
  setTimeout(() => speechSynthesis.speak(u), 100);
}
function say(t) { sub(t); speak(t); }

/* ---------- 本地指令 ---------- */
const LINKS = [
  ['和弦换调', 'https://angeltsien.github.io/chord-transposer/', /和弦|换调/],
  ['交易日志单机版', 'https://angeltsien.github.io/trade-journal/', /单机/],
  ['交易日志 2.0', 'https://angeltsien.github.io/trade-journal-2/', /2\.0|二点零|量子/],
  ['交易日志', 'https://angel-trade-journal.pages.dev', /交易日志|日志/],
  ['赛博粒子', 'https://angeltsien.github.io/cyber-particles/', /粒子/],
  ['Neon Arcade', 'https://angeltsien.github.io/neon-arcade/', /游戏|arcade|街机/i]
];
let weatherText = '天气数据还没取到，先生。';
async function loadWeather(lat = 44.4949, lon = 11.3426, name = '博洛尼亚') {
  try { const j = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`)).json();
    const W = { 0: '晴', 1: '大致晴朗', 2: '多云', 3: '阴天', 45: '有雾', 48: '有雾', 61: '小雨', 63: '中雨', 65: '大雨', 71: '小雪', 73: '中雪', 80: '阵雨', 95: '雷暴' };
    weatherText = `${name}现在${W[j.current.weather_code] || ''}，${Math.round(j.current.temperature_2m)} 度，今天 ${Math.round(j.daily.temperature_2m_min[0])} 到 ${Math.round(j.daily.temperature_2m_max[0])} 度。`;
  } catch (e) {}
}
function local(q) {
  if (/打开|open/i.test(q)) { const l = LINKS.find(x => x[2].test(q)); if (l) { openWin(l[1], l[0]); return `为您打开「${l[0]}」，先生。`; } }
  if (/关闭|关掉|close/i.test(q) && !$('#win').hidden) { closeWin(); return '已关闭。'; }
  if (/几点|时间/.test(q)) return `现在是 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}，先生。`;
  if (/天气/.test(q)) return weatherText;
  if (/交给编程大师/.test(q)) { const task = q.replace(/.*交给编程大师[:：,，\s]*/, '') || lastUser;
    location.href = `mailto:${encodeURIComponent(cfg.mail)}?subject=${encodeURIComponent('[JARVIS 任务] ' + task.slice(0, 40))}&body=${encodeURIComponent(task + '\n\n— Angel')}`;
    return '邮件草稿已打开，请您亲自确认发送。'; }
  return null;
}

/* ---------- 页内窗口（单个） ---------- */
function openWin(url, title) { $('#winTitle').textContent = title; $('#winExt').href = url; $('#winFrame').src = url; $('#win').hidden = false; }
function closeWin() { $('#win').hidden = true; $('#winFrame').src = 'about:blank'; }

/* ---------- 对话 ---------- */
let busy = false, lastUser = '';
async function handle(q) {
  q = q.trim(); if (!q || busy) return; sub(q, true);
  const l = local(q); lastUser = q; if (l) return say(l);
  if (!cfg.key) return say('先生，我的大脑还没接上。请点右上角齿轮，填入免费的 API Key。');
  busy = true; pauseListen(); hist.push({ role: 'user', content: q });
  try { const full = await chat(hist.slice(-cfg.mem), t => sub(t));
    hist.push({ role: 'assistant', content: full }); hist = hist.slice(-40); localStorage.setItem(LSH, JSON.stringify(hist)); busy = false; say(full);
  } catch (e) { hist.pop(); busy = false; sub('连接 AI 失败：' + e.message); resumeListen(); }
}

/* ---------- 免按键语音识别 ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, recOn = false, paused = false, silT = 0, pending = '';
function setupRec() {
  if (!SR) return; rec = new SR(); rec.lang = 'zh-CN'; rec.interimResults = true; rec.continuous = true;
  rec.onstart = () => recOn = true;
  rec.onresult = e => { if (paused) return; let fin = '', tmp = '';
    for (let i = e.resultIndex; i < e.results.length; i++) (e.results[i].isFinal ? (fin += e.results[i][0].transcript) : (tmp += e.results[i][0].transcript));
    pending += fin; sub(pending + tmp, true); clearTimeout(silT);
    silT = setTimeout(() => { const t = pending + tmp; pending = ''; handle(t); }, fin && !tmp ? 700 : 1200); }; // 停顿即发送
  rec.onend = () => { recOn = false; if (cfg.conv && !paused) setTimeout(startRec, 250); };
  rec.onerror = e => { if (/not-allowed/.test(e.error)) { cfg.conv = false; updIcons(); sub('麦克风权限被拒绝，请在浏览器设置里允许。'); } };
}
function startRec() { if (rec && !recOn && !paused && cfg.conv) try { rec.start(); } catch (e) {} }
function pauseListen() { paused = true; clearTimeout(silT); if (rec && recOn) try { rec.abort(); } catch (e) {} }
function resumeListen() { if (busy || speaking) return; paused = false; startRec(); }
function setConv(v) { cfg.conv = v && !!SR; save(); updIcons(); if (cfg.conv) { paused = false; startRec(); } else if (rec) try { rec.abort(); } catch (e) {} }

/* ---------- 麦克风音量（驱动粒子脉动） ---------- */
let analyser = null, abuf, actx = null;
async function startMic() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); await actx.resume();
  if (analyser || !navigator.mediaDevices) return; const s = await navigator.mediaDevices.getUserMedia({ audio: true });
  analyser = actx.createAnalyser(); analyser.fftSize = 256; abuf = new Uint8Array(analyser.frequencyBinCount); actx.createMediaStreamSource(s).connect(analyser); } catch (e) {} }
function level() {
  let v = 0; if (analyser && state() === 'listen') { analyser.getByteFrequencyData(abuf); v = abuf.reduce((a, b) => a + b, 0) / abuf.length / 128; }
  if (speaking) { speakPulse *= 0.9; v = Math.max(v, .35 + .3 * Math.abs(Math.sin(performance.now() / 90)) + speakPulse * .4); }
  return Math.min(v, 1.5);
}

/* ---------- 给 figure.js 的接口 ---------- */
window.JV = { level, state, sub,
  gesture(g) { if (g === 'palm') { setConv(!cfg.conv); say(cfg.conv ? '我在听，先生。' : '暂停聆听。'); } else if (g === 'thumbUp') say('收到，先生。'); } };

/* ---------- 图标 / 设置 / 启动 ---------- */
function updIcons() { $('#convBtn').classList.toggle('on', cfg.conv); $('#camBtn').classList.toggle('on', cfg.cam); }
async function setCam(v) { cfg.cam = v; save(); updIcons();
  try { if (!JV.camera) throw new Error('模块未加载'); await JV.camera(v); } catch (e) { cfg.cam = false; save(); updIcons(); sub('摄像头不可用：' + e.message); } }
window.addEventListener('DOMContentLoaded', () => {
  setupRec(); updIcons(); loadWeather();
  navigator.geolocation?.getCurrentPosition(p => loadWeather(p.coords.latitude, p.coords.longitude, '您这里'), () => {}, { timeout: 8000 });
  $('#initBtn').onclick = () => {
    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) {} // 解锁声音
    $('#boot').classList.add('done'); startMic(); setConv(cfg.conv !== false); if (cfg.cam) setCam(true);
    const h = new Date().getHours();
    say((h < 5 ? '夜深了' : h < 12 ? '早上好' : h < 18 ? '下午好' : '晚上好') + '，先生。JARVIS 已上线。' + (cfg.key ? '' : '请在设置里填入 API Key 来唤醒我的大脑。'));
    if (!SR) setTimeout(() => sub('此浏览器不支持语音识别，请在底部打字。'), 4000);
  };
  $('#txt').onkeydown = e => { if (e.key === 'Enter') { handle(e.target.value); e.target.value = ''; } };
  $('#convBtn').onclick = () => setConv(!cfg.conv);
  $('#camBtn').onclick = () => setCam(!cfg.cam);
  $('#winClose').onclick = closeWin;
  $('#setBtn').onclick = () => { $('#sProv').value = cfg.prov; $('#sKey').value = cfg.key; $('#sModel').value = cfg.model; $('#sModel').placeholder = '默认：' + PROVIDERS[cfg.prov].model; $('#sMail').value = cfg.mail; loadVoices(); $('#settings').hidden = false; };
  $('#sProv').onchange = e => { $('#sModel').placeholder = '默认：' + PROVIDERS[e.target.value].model; $('#sModel').value = ''; };
  $('#sClose').onclick = () => $('#settings').hidden = true;
  $('#sTest').onclick = () => { cfg.voice = $('#sVoice').value; say('Good evening, sir. 先生，声音测试正常。'); };
  $('#sClear').onclick = () => { hist = []; localStorage.removeItem(LSH); sub('记忆已清空'); };
  $('#sSave').onclick = () => { Object.assign(cfg, { prov: $('#sProv').value, key: $('#sKey').value.trim(), model: $('#sModel').value.trim(), mail: $('#sMail').value.trim(), voice: $('#sVoice').value }); save(); $('#settings').hidden = true; sub('已保存：' + PROVIDERS[cfg.prov].name); };
});
