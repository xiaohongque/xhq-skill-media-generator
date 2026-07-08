# 鉴权（Authentication）

每一次 `POST /api/v1/generate` 与 `GET /api/v1/tasks/:taskId` 调用都需要
**Bearer API Key**。**不涉及用户会话**。

该 Key 会解析到你的 xhq 用户账户，因此所有 雀豆 消耗都会计入你的账户，并自动
显示在 Web 端的 **雀豆明细** 页面。

## 获取 Key（在 Web 应用中）

1. 登录 xhq Web 应用。
2. 打开 **设置 → API Keys**（设置 → API 密钥）。
3. 点击 **生成 API Key**（Generate API Key）。Web 应用**仅展示一次**明文 Key。
4. 复制该 Key——它形如 `sk_ <48 个十六进制字符>`。你无法再次查看它；
   若丢失，请在设置中撤销并重新生成。

> 明文 Key 仅展示一次，且永远不会以可恢复的形式存储——请妥善保管。

## 提供 Key

在每一次智能体 API 调用中，将其作为 Bearer Token 发送：

```http
POST https://app.xiaohongque.com/api/v1/generate
Authorization: Bearer sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json
```

或通过 `x-api-key` 请求头：

```http
x-api-key: sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

`scripts/run_task.js` 会自动从环境中读取 `XHQ_API_KEY`。`XHQ_API_BASE` 为
可选（默认 `https://app.xiaohongque.com`）。

## 必需的环境

| 变量 | 说明 |
| --- | --- |
| `XHQ_API_BASE` | **可选。** 后端基础 URL（REST API 主机）。默认为 `https://app.xiaohongque.com`；仅在指向其他部署时设置。 |
| `XHQ_API_KEY` | **必需。** 你的 API Key（`sk_…`）。请保密；它直接映射到账户的 雀豆。 |

## 注意事项

- **切勿分享或提交该 Key。** 在生成场景下，它等同于你的账户。可随时在 Web 应用中撤销。
- Key 背后的用户会为每个任务扣除 雀豆。请确保余额充足，否则
  `POST /api/v1/generate` 会返回 HTTP 402（需要付费）。
- 任务结果按 Key 的所属者隔离；状态轮询会校验归属，因此提交与轮询必须使用同一个 Key。
- `GET /api/v1/capabilities` 为公开接口，无需 Key。
