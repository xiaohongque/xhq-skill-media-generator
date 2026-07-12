# Provider 目录

本目录是 `GET /api/v1/capabilities`（公开，无需 Key）返回的**确切列表**。下面每个
`key` 都是一个**路由组**——将其作为 `provider` 值传给 `POST /api/v1/generate`，
后端会为你选择当前可用的最佳底层生成器。

```http
POST https://app.xiaohongque.com/api/v1/generate
Authorization: Bearer {XHQ_API_KEY}
{ "provider": "<GROUP_KEY>", ...params }
```

随后轮询 `GET https://app.xiaohongque.com/api/v1/tasks/:taskId` 直到终态。所有结果
均为 OSS URL，位于 `result.videos` / `result.images` / `result.audios`。

> 基础域名默认为 `https://app.xiaohongque.com`；仅在非默认部署时，才用
> `XHQ_API_BASE` 环境变量覆盖它。

> **`provider` 的值必须是 `GET /api/v1/capabilities` 返回的某个 `key`**
> （例如 `video.seedance-2.0`、`image.banana`）。这些是路由组键；不要传入
> `danmugo`、`seedance-2-0-rp` 这类单独的生成器名称——只有路由组键是被公开
> 列出且受支持的。

## 实时目录（即 `/api/v1/capabilities` 的返回）

```json
{
  "success": true,
  "providers": [
    { "key": "video.seedance-2.0",      "kind": "video", "description": "Seedance 2.0 video generation" },
    { "key": "video.seedance-fast-2.0", "kind": "video", "description": "Seedance 2.0 video generation" },
    { "key": "video.seedance-mini-2.0", "kind": "video", "description": "Seedance 2.0 video generation" },
    { "key": "video.grok-image-1.5",    "kind": "video", "description": "Grok Image 1.5 video generation" },
    { "key": "image.gpt-image-2",       "kind": "image", "description": null },
    { "key": "image.banana",            "kind": "image", "description": "Banana series image generation (Gemini Flash/Pro) — model-iteration failover" }
  ]
}
```

## 视频生成（路由组键）

| Provider（`provider`）    | 说明                    | 关键参数                                                                                                        |
| --------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| `video.seedance-2.0`      | Seedance 2.0 视频生成   | `prompt`, `image_urls`（≤3）, `video_url`, `audio_url`, `duration`, `aspect_ratio`, `resolution` |
| `video.seedance-fast-2.0` | Seedance 2.0 快速档     | 同`video.seedance-2.0`                                                                                        |
| `video.seedance-mini-2.0` | Seedance 2.0 mini 档    | 同`video.seedance-2.0`                                                                                        |
| `video.grok-image-1.5`    | Grok Image 1.5 视频生成 | `prompt`, `image_urls`, `duration`, `aspect_ratio`                                                      |

## 图像生成（路由组键）

| Provider（`provider`） | 说明                                                        | 关键参数                                                    |
| ------------------------ | ----------------------------------------------------------- | ----------------------------------------------------------- |
| `image.gpt-image-2`    | GPT-Image-2 图像生成                                        | `prompt`, `image_urls`, `size`, `resolution`, `n` |
| `image.banana`         | Banana 系列图像生成（Gemini Flash/Pro）——模型迭代故障转移 | `prompt`, `image_urls`, `size`, `resolution`, `n` |

## 通用参数

`prompt`、`negative_prompt`、`image_urls`（图生视频 / 图像参考）、`video_urls`、
`audio_url`、`duration`（秒）、`aspect_ratio`（`16:9`/`9:16`/`1:1`/...）、
`resolution`、`model`、`provider_params`（provider 专属扩展）、`first_frame`、
`last_frame`、`generate_audio`、`size`、`n`。

### 示例 — 通过路由组键使用 Seedance 2.0

```bash
node scripts/run_task.js --provider video.seedance-2.0 --params '{
  "prompt": "A calm ocean wave gently rolling toward the shore at golden hour",
  "image_urls": ["https://example.com/ref.jpg"],
  "duration": 5,
  "aspect_ratio": "16:9",
  "resolution": "720p"
}'
```

## 输出形态（所有 provider）

```json
{
  "taskId": "...",
  "status": "succeeded",
  "result": {
    "videos": [{ "url": "https://oss.../v.mp4" }],
    "images": [],
    "audios": []
  }
}
```

对于文本输出类能力（如 `videoAnalyze`），形态使用 `result.texts`。

## 失败处理

- `POST /api/v1/generate` 在以下情况返回错误（HTTP 4xx/5xx，响应体含 `code`
  和 `message`）：provider 未知（400）、缺少 prompt（400）、API Key 无效（401）、
  任务不属于你（403）、或 雀豆 不足（402）。
- 轮询过程中，`status: failed` / `error` 表示任务失败；`error` 字段携带错误信息。
  失败时后端会自动退还 雀豆。
- `status: partial` 表示任务结束但部分输出失败；请检查 `result` 中哪些 URL 成功。
