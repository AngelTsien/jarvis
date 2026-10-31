# J.A.R.V.I.S. — Angel 的钢铁侠风个人助手

纯静态网页（index.html + app.js + style.css），无需构建，可直接部署到 GitHub Pages。

## 功能
- 开机动画「JARVIS ONLINE」、方舟反应堆全息圆环（随麦克风音量 / 朗读 / 思考脉动）、旋转 HUD、扫描线
- 左侧：时钟、天气（Open-Meteo，免 Key；允许定位用当前位置，否则默认 Bologna）、项目快捷链接
- 右侧：US100（OANDA:NAS100USD）与 USOIL（TVC:USOIL）TradingView 迷你行情
- 语音：按住 🎙️ 说话（zh-CN）；⚙️ 里可开启唤醒词「Jarvis / 贾维斯」常驻监听；朗读回复（尽量选男声），🔊 一键静音
- 本地指令（不需要 AI）：「打开交易日志 / 单机版 / 2.0 / 游戏 / 粒子 / 和弦」「现在几点」「天气」「静音」
- AI 对话：Groq（默认）/ Gemini / OpenRouter，流式输出，保留最近 N 条作记忆
- 📨 或说「交给编程大师 + 任务」：打开一封邮件草稿（收件人在设置里填），**只打开草稿，不会自动发送**

## 获取免费 API Key（三选一，推荐 Groq）
### Groq（默认，速度最快）
1. 打开 https://console.groq.com 用 Google 或邮箱注册登录
2. 进入 https://console.groq.com/keys → Create API Key → 复制
3. Jarvis 右上角 ⚙️ → 服务商选 Groq → 粘贴 Key → 保存
- 免费额度（官方 https://console.groq.com/docs/rate-limits，2026-10 查看）：默认模型 `openai/gpt-oss-120b` 每分钟 30 次、每天 1000 次、每分钟 8K tokens、每天 200K tokens。

### Google Gemini
1. 打开 https://aistudio.google.com/apikey 用 Google 账号登录 → Create API key → 复制
2. ⚙️ → 服务商选 Gemini → 粘贴 → 保存（默认模型 `gemini-2.5-flash`，可改）
- 免费层不用绑卡；具体每分钟/每天次数官方只在 AI Studio 里显示（https://ai.google.dev/gemini-api/docs/rate-limits）。不要开通计费，就不会产生费用。

### OpenRouter
1. https://openrouter.ai 注册 → https://openrouter.ai/keys 创建 Key
2. ⚙️ → 选 OpenRouter → 粘贴；模型默认 `openrouter/free`（自动选免费模型），也可填任意以 `:free` 结尾的模型
- 免费模型每天次数很有限（以官网 https://openrouter.ai/docs/api-reference/limits 为准）。

**安全**：Key 只保存在你这台设备浏览器的 localStorage，不会写进代码或仓库。换设备需要重新填。公共电脑用完请在 ⚙️ 清空。

## 浏览器支持
| 功能 | Chrome / Edge（电脑、安卓） | Safari（iOS/Mac） | Firefox |
|---|---|---|---|
| 语音识别 | ✅（需联网，走 Google 服务） | ⚠️ iOS 14.5+ 部分支持，不稳定 | ❌ 用文字输入 |
| 朗读 | ✅ | ✅ | ✅ |
| 唤醒词常驻 | ✅ 页面需保持前台 | ⚠️ 经常自动断开 | ❌ |

- 麦克风只能在 https 或 localhost 下使用（GitHub Pages 是 https）。
- 中国大陆访问 Groq / Gemini / OpenRouter、TradingView、Google 语音识别一般需要代理。

## 本地运行
```bash
cd jarvis && python3 -m http.server 8790
# 打开 http://localhost:8790
```

## 常见问题
- 「连接 AI 失败 401」：Key 错或没选对服务商。「429」：超出免费额度，等一会儿或换服务商。
- 没声音：检查 🔊 是否静音；iOS 首次需要先点一下页面。
- 麦克风无反应：浏览器地址栏允许麦克风权限。
