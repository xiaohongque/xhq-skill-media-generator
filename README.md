# XHQ Media Generator

> 🌐 Other languages: [简体中文](./README.zh-CN.md)

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

## How a user gets started

### Step 1 — Create an API Key in the product

![Create API Key](./docs/screen.png)

1. Log into the [XHQ AI web app](https://www.xiaohongque.com) (or sign up for a free account first).
2. Go to **Settings → Account → API Keys**.
3. Click **"+ Create Key"** and enter a recognizable name (e.g. "My Script", "Third-party Integration"). Default permissions include:
   - `generate`
   - `task query`
4. After creating, the system shows the **plaintext key only once** (looks like `sk_…`). Copy and store it safely immediately — it cannot be viewed again after closing.

> The list shows only a masked prefix (e.g. `xhq_sk_••••••••`), status (active / revoked), permission tags, and created / last-used time.

### Step 2 — Wire it into your agent

The simplest way to install the skill is to let your agent do it for you. Open
your agent app (CodeBuddy, Claude, Cursor, or any compatible client) and just
say:

> "Guide me through installing this skill: https://github.com/xiaohongque/xhq-skill-media-generator"

Your agent will clone the repository into the correct skills directory and set
everything up automatically — no manual file copying required. Then hand it your
API key so it can authenticate its calls:

```
XHQ_API_KEY  = sk_…          # from step 1
# XHQ_API_BASE is optional (defaults to https://app.xiaohongque.com)
```

Once installed, the agent invokes the REST API on your behalf and 雀豆 are
deducted from your account. Open 雀豆明细 in the web app to see every agent
consumption.

### Security management

- **A key equals your account**: never share it or commit it to a repo.
- **Revoke anytime**: click "Revoke" in the key list to invalidate it immediately. If you suspect a leak, revoke first, then create a new one.
- **Least privilege**: the default scope is only `generate` + `task query`, following the principle of least privilege.
- The key resolves back to the same account, so 雀豆 consumption appears automatically in 雀豆明细 — no extra billing setup needed.

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

| Var              | Description                                                                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `XHQ_API_BASE` | **Optional.** Backend base URL (no `/1.1` suffix). Defaults to `https://app.xiaohongque.com`. Set only for a non-default deployment. |
| `XHQ_API_KEY`  | **Required.** Bearer API key (`sk_…`) — see `references/auth.md`                                                                   |

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
