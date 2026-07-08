# model-capabilities (public skill)

A portable, agent-agnostic skill that teaches an AI agent how to invoke the
**xhq backend** generative AI capabilities (video generation, image generation,
digital-human / talking-avatar synthesis, video & image editing) through a
**standard REST API secured by a Bearer API key**.

It is designed to be consumed by **any** agent — CodeBuddy, Codex, Claude,
Cursor, or a custom agent — not just one product. No LeanCloud SDK and no user
session are required: just HTTP + a key.

## Why this exists

The backend exposes a large catalog of "model capabilities" behind a single
uniform interface:

- `POST /api/v1/generate` `{ provider, params }` → `{ taskId, ... }`
- `GET /api/v1/tasks/:taskId` → `{ status, result: { videos[], images[], audios[] } }`

The only thing an agent needs to know is **which `provider` to use and with
which params**. This skill supplies that knowledge in a plain, portable form,
plus a runnable helper script so agents that execute code don't have to
re-derive the submit/poll flow each time.

## How a user gets started (the flow)

```
1. User logs into the xhq web app
2. User opens Settings → "API Keys" → clicks "生成 API Key"
3. Web app mints a new key → returns a plaintext key ONCE
4. User copies the key (sk_…)
5. User installs this skill in their agent and sets:
     XHQ_API_KEY  = sk_…
     # XHQ_API_BASE is optional (defaults to https://app.xiaohongque.com)
6. Agent calls the REST API; 雀豆 are deducted from the user's account
7. User opens 雀豆明细 in the web app → sees every agent consumption
```

The API key simply resolves back to the same `_User` whose 雀豆 are already
deducted by the backend, so **no billing change is needed** — consumption shows
up in 雀豆明细 automatically.

## Layout

```
model-capabilities/
├── SKILL.md                 # frontmatter (CodeBuddy trigger) + agent-agnostic body
├── README.md                # this file
├── scripts/
│   └── run_task.js          # submit → poll → print OSS result (Node 18+, no deps)
└── references/
    ├── catalog.md           # provider catalog: video + image + digital human
    └── auth.md              # how to obtain & supply a Bearer API key
```

## Using with different agents

### CodeBuddy
Place the folder under `.codebuddy/skills/model-capabilities/` in the repo (or
`~/.codebuddy/skills/`). CodeBuddy reads the `SKILL.md` frontmatter to
auto-trigger and reads the body as instructions.

### Codex / other agents (AGENTS.md pattern)
Reference the skill body from your `AGENTS.md` / system prompt:

```markdown
When the user wants to generate video, an image, or a digital human, follow
`.codebuddy/skills/model-capabilities/SKILL.md`, which documents the
`/api/v1/generate` and `/api/v1/tasks/:taskId` REST endpoints and the provider
catalog in `references/catalog.md`. Use `scripts/run_task.js` to execute a task.
```

Other agents ignore the YAML frontmatter and read the markdown body directly.

## Environment variables (used by `run_task.js` and direct REST calls)

| Var | Description |
| --- | --- |
| `XHQ_API_BASE` | **Optional.** Backend base URL (no `/1.1` suffix). Defaults to `https://app.xiaohongque.com`. Set only for a non-default deployment. |
| `XHQ_API_KEY` | **Required.** Bearer API key (`sk_…`) — see `references/auth.md` |

## Extending the catalog

Append entries to `references/catalog.md` following the existing format. The
interface does not change. You can also query `GET /api/v1/capabilities` at
runtime to discover currently-registered providers.

## Packaging

If you use the CodeBuddy skill tooling:

```bash
python <skill-creator>/scripts/package_skill.py \
  --skill-path .codebuddy/skills/model-capabilities
```

This validates and zips the skill for distribution.
