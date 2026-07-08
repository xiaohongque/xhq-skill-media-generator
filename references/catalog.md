# Provider Catalog

This catalog is the **exact** list returned by `GET /api/v1/capabilities`
(public, no key). Each `key` below is a **routing group** — pass it as the
`provider` value to `POST /api/v1/generate`, and the backend selects the best
available underlying generator for you.

```http
POST https://app.xiaohongque.com/api/v1/generate
Authorization: Bearer {XHQ_API_KEY}
{ "provider": "<GROUP_KEY>", ...params }
```

then poll `GET https://app.xiaohongque.com/api/v1/tasks/:taskId` until terminal. All results
are OSS URLs in `result.videos` / `result.images` / `result.audios`.

> The base host defaults to `https://app.xiaohongque.com`; override with the
> `XHQ_API_BASE` env var only for a non-default deployment.

> **The `provider` value must be one of the `key`s returned by
> `GET /api/v1/capabilities`** (e.g. `video.seedance-2.0`, `image.banana`).
> These are routing-group keys; do not pass an individual generator name such
> as `danmugo` or `seedance-2-0-rp` — only the group keys are advertised and
> supported.

## Live catalog (as returned by `/api/v1/capabilities`)

```json
{
  "success": true,
  "groups": [
    { "key": "video.seedance-2.0",      "kind": "video", "description": "Seedance 2.0 video generation" },
    { "key": "video.seedance-fast-2.0", "kind": "video", "description": "Seedance 2.0 video generation" },
    { "key": "video.seedance-mini-2.0", "kind": "video", "description": "Seedance 2.0 video generation" },
    { "key": "video.grok-image-1.5",    "kind": "video", "description": "Grok Image 1.5 video generation" },
    { "key": "image.gpt-image-2",       "kind": "image", "description": null },
    { "key": "image.banana",            "kind": "image", "description": "Banana series image generation (Gemini Flash/Pro) — model-iteration failover" }
  ]
}
```

## Video generation (group keys)

| Provider (`provider`) | Description | Key params |
| --- | --- | --- |
| `video.seedance-2.0` | Seedance 2.0 video generation | `prompt`, `image_urls` (≤3), `video_url`, `audio_url`, `duration`, `aspect_ratio`, `resolution` |
| `video.seedance-fast-2.0` | Seedance 2.0 fast tier | same as `video.seedance-2.0` |
| `video.seedance-mini-2.0` | Seedance 2.0 mini tier | same as `video.seedance-2.0` |
| `video.grok-image-1.5` | Grok Image 1.5 video generation | `prompt`, `image_urls`, `duration`, `aspect_ratio` |

## Image generation (group keys)

| Provider (`provider`) | Description | Key params |
| --- | --- | --- |
| `image.gpt-image-2` | GPT-Image-2 image generation | `prompt`, `image_urls`, `size`, `resolution`, `n` |
| `image.banana` | Banana series image generation (Gemini Flash/Pro) — model-iteration failover | `prompt`, `image_urls`, `size`, `resolution`, `n` |

## Common params

`prompt`, `negative_prompt`, `image_urls` (image-to-video / image references),
`video_urls`, `audio_url`, `duration` (seconds), `aspect_ratio`
(`16:9`/`9:16`/`1:1`/...), `resolution`, `model`, `provider_params`
(provider-specific extras), `first_frame`, `last_frame`, `generate_audio`,
`size`, `n`.

### Example — Seedance 2.0 via the group key

```bash
node scripts/run_task.js --provider video.seedance-2.0 --params '{
  "prompt": "A calm ocean wave gently rolling toward the shore at golden hour",
  "image_urls": ["https://example.com/ref.jpg"],
  "duration": 5,
  "aspect_ratio": "16:9",
  "resolution": "720p"
}'
```

## Additional registered providers (not in `/api/v1/capabilities` yet)

The following generators are valid `provider` values for `POST /api/v1/generate`
but are **not** currently returned by `/api/v1/capabilities`. They are listed
here for completeness; prefer the group keys above when available.

### Digital human (talking avatar / portrait animation)

- `digitalHuman-video` — drive a source video with audio. Params: `sourceVideoUrl`, `audioUrl`, `options` (`startSec`, `endSec`, `fps`, `advancedOptimize`). Credit `20 + 5 × durationSec`.
- `digitalHuman-image-normal` — animate a portrait image with audio. Params: `sourceImageUrl`, `audioUrl`, `options` (`maxSide`, `fps`, `prompt`, `startTime`, `endTime`, `accelerate`). Credit `10 + 3 × durationSec`.
- `digitalHuman-image-dynamic` — dynamic portrait from image + audio. Params: `sourceImageUrl`, `audioUrl`, `options` (`dynamic`, `longestSide`, `totalFrames`). Credit fixed `50`.
- `digitalHuman-text-driven` — portrait + text script + voice. Params: `sourceImageUrl`, `options` (`aspectRatio`, `text`, `voiceSelect`, `emotion`, `cloneAudioUrl`). Credit `10 + 2 × durationSec`.
- `digitalHuman-sales` — sales video from a product portrait. Params: `sourceImageUrl`, `options` (`durationSeconds`, `resolution`, `polishPrompt`, `prompt`). Credit `15 + 2 × durationSec`.

### Image / video editing & utilities

`garmentChange`, `hotRemake`, `detailPage`, `imageUpscale`, `lighting`,
`outpaint`, `poseChange`, `fullAngle`, `patternPrintExtract`, `phoneSelfie`,
`videoFaceSwap`, `videoUpscale`, `videoWatermarkRemoval`, `videoAnalyze`,
`audioClone`. Each takes provider-specific params (see
`libs/runninghub-providers.js`).

## Output shape (all providers)

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

For text-output capabilities (e.g. `videoAnalyze`) the shape uses `result.texts`.

## Failure handling

- `POST /api/v1/generate` returns an error (HTTP 4xx/5xx JSON body with `code`
  and `message`) when the provider is unknown (400), the prompt is missing
  (400), the API key is invalid (401), the task isn't yours (403), or credits
  are insufficient (402).
- During polling, `status: failed` / `error` means the task failed; the
  `error` field carries the message. Credits are automatically refunded on
  failure by the backend.
- `status: partial` means the task finished but some outputs failed; inspect
  `result` for which URLs succeeded.
