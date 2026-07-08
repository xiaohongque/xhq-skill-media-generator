# Authentication

Every `POST /api/v1/generate` and `GET /api/v1/tasks/:taskId` call requires a
**Bearer API key**. There is **no user session** involved.

The key resolves to your xhq user account, so all 雀豆 consumption is billed to
you and appears in the web **雀豆明细** page automatically.

## Get a key (in the web app)

1. Log into the xhq web app.
2. Open **Settings → API Keys** (设置 → API 密钥).
3. Click **生成 API Key** (Generate API Key). The web app shows the
   plaintext key **once**.
4. Copy the key — it looks like `sk_ <48 hex chars>`. You cannot view it
   again; if lost, revoke it from settings and generate a new one.

> The plaintext key is shown only once and is never stored in a recoverable
> form — keep it safe.

## Supply the key

Send it as a Bearer token on every agent API call:

```http
POST https://app.xiaohongque.com/api/v1/generate
Authorization: Bearer sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json
```

or via the `x-api-key` header:

```http
x-api-key: sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

`scripts/run_task.js` reads `XHQ_API_KEY` from the environment automatically.
`XHQ_API_BASE` is optional (defaults to `https://app.xiaohongque.com`).

## Required environment

| Var | Description |
| --- | --- |
| `XHQ_API_BASE` | **Optional.** Backend base URL (the REST API host). Defaults to `https://app.xiaohongque.com`; set only for a different deployment. |
| `XHQ_API_KEY` | **Required.** Your API key (`sk_…`). Keep it secret; it maps directly to your account's 雀豆. |

## Notes

- **Never share the key or commit it.** It is equivalent to your account for
  generation purposes. Revoke it from the web app at any time.
- The user behind the key is billed 雀豆 for each task. Ensure sufficient
  balance, or `POST /api/v1/generate` returns HTTP 402 (payment required).
- Task results are scoped to the key's owner; status polling enforces
  ownership, so the same key must be used for submit and poll.
- `GET /api/v1/capabilities` is public and needs no key.
