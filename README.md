# J.A.R.V.I.S. — Angel 的粒子人形助手

极简黑色舞台，中间是由数万粒子组成的 JARVIS 人形。纯静态网页，无需构建；Three.js 和 MediaPipe 都放在 `vendor/`，不依赖 CDN。

## 使用
1. 打开网页，点 **INITIALIZE**（解锁声音和麦克风），允许麦克风。
2. 直接说话：停顿约 1 秒自动发送，JARVIS 用声音回答，字幕在底部淡入淡出。说话时粒子随声音脉动，聆听时有青色波纹。
3. 右上角三个图标：🎙️ 免按键对话开关 · ✋ 摄像头手势 · ⚙️ 设置（AI 服务商、Key、声音、测试声音）。左上角小圆点：灰＝待命，青＝在听，粉＝思考，白＝说话。
4. 也可以在底部打字，回车发送。

## 语音指令（不需要 AI）
「打开 交易日志 / 单机版 / 2.0 / 游戏 / 粒子 / 和弦」（页内窗口打开，「关闭」或 ✕ 关掉）· 「现在几点」· 「天气」· 「交给编程大师 + 任务」（只打开邮件草稿，不会自动发送）

## 手势（打开 ✋ 后）
| 手势 | 作用 |
|---|---|
| 手在镜头前移动 | JARVIS 头部和身体跟随你的手，附近粒子被吸引、泛起涟漪 |
| 🤏 捏合 + 左右移动 | 转动 JARVIS 身体 |
| ✋ 张开手掌静止 1 秒 | 开 / 关聆听 |
| 👍 竖大拇指 | JARVIS 回应「收到，先生」 |

每个手势触发后有 2.5 秒冷却，防止误触。

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
- 语音识别：Chrome / Edge（电脑、安卓）最好；iOS Safari 不稳定；Firefox 不支持（用打字）。
- 声音：取决于系统自带语音，Edge 的 Microsoft 男声最像电影。可在设置里选。
- 麦克风/摄像头需要 https（GitHub Pages 已是 https）。
- 中国大陆访问 AI 服务和 Google 语音识别一般需要代理。

## 本地运行
```bash
python3 -m http.server 8790   # 打开 http://localhost:8790
```
