# 小红雀媒体生成

一个可移植、与智能体无关的技能，用于教会 AI 智能体如何通过 **标准 REST API
（Bearer API Key 鉴权）** 调用 小红雀 **后端** 的生成式 AI 能力（视频生成、图像生成、
数字人 / 口播数字人合成、视频与图像编辑）。

它的设计目标是被**任意**智能体消费——CodeBuddy、Codex、Claude、Cursor 或
自定义智能体——而不仅限于某个产品。无需 SDK，也无需用户会话：
只需要 HTTP + 一个 Key。

## 为什么存在

后端通过一套统一的接口暴露了大量「模型能力」：

- `POST /api/v1/generate` `{ provider, params }` → `{ taskId, ... }`
- `GET /api/v1/tasks/:taskId` → `{ status, result: { videos[], images[], audios[] } }`

智能体唯一需要知道的就是**用哪个 `provider`、配合哪些参数**。本技能以简洁、
可移植的形式提供这些知识，外加一个可运行的辅助脚本，让能够执行代码的智能体
不必每次都重新推导「提交 / 轮询」流程。

## 用户如何开始（流程）

```
1. 用户登录 https://www.xiaohongque.com 应用
2. 用户打开 设置 → "API Keys" → 点击 "生成 API Key"
3. Web 应用生成新 Key → 仅返回一次明文 Key
4. 用户复制该 Key（sk_…）
5. 用户在本技能所服务的智能体中安装并设置：
     XHQ_API_KEY  = sk_…
     # XHQ_API_BASE 可选（默认 https://app.xiaohongque.com）
6. 智能体调用 REST API；雀豆 从用户账户中扣除
7. 用户打开 Web 应用中的 雀豆明细 → 看到每一次智能体的消耗
```


## 目录结构

```
<root>/
├── SKILL.md                 # frontmatter（CodeBuddy 触发）+ 与智能体无关的正文
├── README.md                # 本文件
├── scripts/
│   └── run_task.js          # 提交 → 轮询 → 打印 OSS 结果（Node 18+，无依赖）
└── references/
    ├── catalog.md           # provider 目录：视频 + 图像 + 数字人
    └── auth.md              # 如何获取并提供 Bearer API Key
```

## 在不同智能体中使用

### CodeBuddy

将文件夹放在仓库的 `.codebuddy/skills/`（或
`~/.codebuddy/skills/`）下。CodeBuddy 读取 `SKILL.md` 的 frontmatter 来自动
触发，并将正文作为指令读取。

### Codex / 其他智能体（AGENTS.md 模式）

在你的 `AGENTS.md` / system prompt 中引用本技能正文：

```markdown
当用户想要生成视频、图像或数字人时，请遵循
`.codebuddy/skills/model-capabilities/SKILL.md`，其中记录了
`/api/v1/generate` 与 `/api/v1/tasks/:taskId` REST 端点以及
`references/catalog.md` 中的 provider 目录。使用 `scripts/run_task.js` 执行任务。
```

其他智能体会忽略 YAML frontmatter，直接读取 markdown 正文。

## 环境变量（供 `run_task.js` 与直接 REST 调用使用）

| 变量             | 说明                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| `XHQ_API_BASE` | **可选。** 后端基础 URL（不含 `/1.1` 后缀）。默认为 `https://app.xiaohongque.com`。仅在非默认部署时设置。 |
| `XHQ_API_KEY`  | **必需。** Bearer API Key（`sk_…`）——见 `references/auth.md`                                           |

## 扩展目录

按现有格式向 `references/catalog.md` 追加条目即可，接口不变。你也可以在运行时
查询 `GET /api/v1/capabilities` 来发现当前已注册的 provider。

## 打包

如果你使用 CodeBuddy 技能工具：

```bash
python <skill-creator>/scripts/package_skill.py \
  --skill-path .codebuddy/skills/model-capabilities
```

该命令会校验并将技能打包为 zip 以便分发。
