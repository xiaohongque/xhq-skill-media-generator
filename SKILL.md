---
name: model-capabilities
description: >-
  Use when an agent needs to invoke the xhq backend's AI "model capabilities"
  (text/image-to-video generation, image generation, digital-human / talking-
  avatar synthesis, video & image editing) on behalf of a user. Trigger on
  intents such as "generate a video from this prompt/image", "make a digital
  human / talking avatar from this photo and audio", "upscale this video",
  "swap a face in a video", "drive a portrait with audio", etc. Capabilities are
  exposed through a standard REST API secured by a Bearer API key: POST
  /api/v1/generate, GET /api/v1/tasks/:taskId, and a public GET
  /api/v1/capabilities catalog. A runnable helper, scripts/run_task.js, performs
  submit → poll → return-OSS-URL with zero dependencies (plain fetch).
---

# xhq Model Capabilities

This skill lets an AI agent call the xhq backend's generative AI capabilities
over a **standard REST API** authenticated with a **Bearer API key** — no
special SDK, no user session required.

Every capability is invoked the **same way**: submit a task with a `provider`
name, then poll for the result. Results are returned as OSS (object-storage)
URLs.

## Mental model

```
agent ──POST /api/v1/generate (Bearer key)──▶ { taskId }
agent ──GET  /api/v1/tasks/:taskId  [poll]──▶ { status, result: { videos[], images[], audios[] } }
```

- **`POST /api/v1/generate`** — start a task. Body `{ provider, prompt, ... }`.
  Returns `{ taskId, generatorTaskId, provider, status }`.
- **`GET /api/v1/tasks/:taskId`** — poll a task. Returns
  `{ status, result, error, progress }`.
- **`GET /api/v1/capabilities`** (public) — live catalog of providers.
- The `provider` value selects the model/capability (see `references/catalog.md`).
- All results are OSS URLs in `result.videos` / `result.images` / `result.audios`.

## Two ways to invoke

### A. Run the helper script (recommended for deterministic execution)

`scripts/run_task.js` does submit + polling in one shot and prints the final
result JSON. It is agent-agnostic (plain Node 18+, no dependencies).

```bash
export XHQ_API_KEY="sk_..."                         # the API key you generated in the web app
# XHQ_API_BASE is optional; defaults to https://app.xiaohongque.com
# export XHQ_API_BASE="https://<your-xhq-host>"    # only if you use a non-default host

node scripts/run_task.js \
  --provider video.seedance-2.0 \
  --params '{"prompt":"A calm ocean wave rolling toward shore","image_urls":["https://.../ref.jpg"],"duration":5,"aspect_ratio":"16:9"}'
```

It prints the final `{ taskId, status, result }` and exits non-zero on failure.

### B. Call the REST API directly

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

Response: `{ "success": true, "taskId": "...", "generatorTaskId": "...", "provider": "seedance-2-0-rp", "status": "pending" }`

Then poll:

```http
GET https://app.xiaohongque.com/api/v1/tasks/<taskId>
Authorization: Bearer {XHQ_API_KEY}
```

Poll every ~15s until `status` is terminal:
`succeeded` / `completed` / `success` / `done` / `ready` / `partial` (success),
or `failed` / `error` / `cancelled` / `timeout` (failure). Intermediate states
to keep polling: `preparing`, `pending`, `processing`, `running`, `uploading`,
`throttled`, `retrying`.

> Note: after a provider reports success, the backend uploads results to OSS and
> may briefly report `processing`/`uploading` again. Keep polling until a
> terminal status appears.

## Authentication

Every mutating/status call requires a **Bearer API key** (`Authorization:
Bearer <key>`, or the `x-api-key` header). Generate the key in the web app (see
`references/auth.md`) — there is no user session involved. The key resolves
to your user account, so all 雀豆 consumption is billed to you and shows up in
the web **雀豆明细** page automatically.

## Choosing a provider

Read `references/catalog.md` for provider names, required params, and credit
costs. You can also fetch the live catalog at runtime:

```http
GET https://app.xiaohongque.com/api/v1/capabilities
```

> The base host defaults to `https://app.xiaohongque.com`. Override it with the
> `XHQ_API_BASE` env var only when pointing at a different deployment.

> The `provider` value **must be one of the `key`s returned by
> `GET /api/v1/capabilities`** (e.g. `video.seedance-2.0`, `image.banana`).
> These are routing-group keys that resolve to an underlying generator; only
> the group keys are advertised and supported.

## Cost awareness

Most capabilities consume credits (雀豆) from your account balance at submit
time; insufficient balance returns HTTP 402. The catalog notes each provider's
pricing so the agent can warn the user before calling.
