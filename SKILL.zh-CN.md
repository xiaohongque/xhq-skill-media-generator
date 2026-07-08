# 小红雀模型能力（Model Capabilities）

本技能让 AI 智能体通过**标准 REST API**（使用 **Bearer API Key** 鉴权）调用 xhq 后端的生成式 AI 能力——**无需特殊 SDK，也无需用户登录会话**。

每个能力都用**相同的方式**调用：提交一个带 `provider` 名称的任务，然后轮询结果。结果以 OSS（对象存储）URL 的形式返回。

## 心智模型

```
agent ──POST /api/v1/generate (Bearer key)──▶ { taskId }
agent ──GET  /api/v1/tasks/:taskId  [轮询]──▶ { status, result: { videos[], images[], audios[] } }
```

- **`POST /api/v1/generate`** —— 启动一个任务。请求体 `{ provider, prompt, ... }`。
  返回 `{ taskId, generatorTaskId, provider, status }`。
- **`GET /api/v1/tasks/:taskId`** —— 轮询任务状态。返回
  `{ status, result, error, progress }`。
- **`GET /api/v1/capabilities`**（公开）—— 实时的 provider 目录。
- `provider` 的值用于选择模型/能力（见 `references/catalog.md`）。
- 所有结果均为 OSS URL，位于 `result.videos` / `result.images` / `result.audios`。

## 两种调用方式

### A. 运行辅助脚本（推荐用于确定性执行）

`scripts/run_task.js` 一次性完成「提交 + 轮询」并打印最终结果 JSON。它
与智能体无关（纯 Node 18+，无依赖）。

```bash
export XHQ_API_KEY="sk_..."                         # 你在 Web 应用中生成的 API Key
# XHQ_API_BASE 可选；默认 https://app.xiaohongque.com
# export XHQ_API_BASE="https://<your-xhq-host>"    # 仅当你使用非默认域名时设置

node scripts/run_task.js \
  --provider video.seedance-2.0 \
  --params '{"prompt":"A calm ocean wave rolling toward shore","image_urls":["https://.../ref.jpg"],"duration":5,"aspect_ratio":"16:9"}'
```

脚本会打印最终的 `{ taskId, status, result }`，失败时以非零状态码退出。

### B. 直接调用 REST API

```http
POST https://app.xiaohongque.com/api/v1/generate
Authorization: Bearer {XHQ_API_KEY}
Content-Type: application/json

{ "provider": "seedance-2-0-rp",
  "prompt": "A calm ocean wave rolling toward shore",
  "image_urls": ["https://.../ref.jpg"],
  "duration": 5,
  "aspect_ratio": "16:9" }
```

响应：`{ "success": true, "taskId": "...", "generatorTaskId": "...", "provider": "seedance-2-0-rp", "status": "pending" }`

随后轮询：

```http
GET https://app.xiaohongque.com/api/v1/tasks/<taskId>
Authorization: Bearer {XHQ_API_KEY}
```

每隔约 15 秒轮询一次，直到 `status` 进入终态：
`succeeded` / `completed` / `success` / `done` / `ready` / `partial`（成功），
或 `failed` / `error` / `cancelled` / `timeout`（失败）。需要继续轮询的中间状态：
`preparing`、`pending`、`processing`、`running`、`uploading`、
`throttled`、`retrying`。

> 注意：provider 报告成功之后，后端会将结果上传到 OSS，可能短暂再次报告
> `processing`/`uploading`。请持续轮询，直到出现终态为止。

## 鉴权

每一次变更/状态查询调用都需要 **Bearer API Key**（`Authorization: Bearer <key>`，或 `x-api-key` 请求头）。在 Web 应用中生成该 Key（见
`references/auth.md`）——不涉及用户会话。该 Key 会解析到你的用户账户，
因此所有 雀豆 消耗都会计入你的账户，并自动显示在 Web 端的 **雀豆明细** 页面。

## 选择 provider

阅读 `references/catalog.md` 了解 provider 名称、必需参数与 雀豆 成本。你也可以
在运行时拉取实时目录：

```http
GET https://app.xiaohongque.com/api/v1/capabilities
```

> `provider` 的值**必须是 `GET /api/v1/capabilities` 返回的某个 `key`**
> （例如 `video.seedance-2.0`、`image.banana`）。这些是路由组键，会解析到某个
> 底层生成器；只有路由组键是被公开列出且受支持的。

> 基础域名默认为 `https://app.xiaohongque.com`。仅在指向其他部署时，才用
> `XHQ_API_BASE` 环境变量覆盖它。

## 成本须知

大多数能力在提交时会从你的账户余额中扣除 雀豆（积分）；余额不足会返回
HTTP 402。目录中标注了每个 provider 的定价，以便智能体在调用前提醒用户。
