# 小红雀媒体生成

> 🌐 其他语言：[English](./README.md)

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

## 用户如何开始

### 一、第一步：在产品中创建 API Key

![创建 API Key](./docs/screen.png)

1. 登录 [小红雀 AI 网页端](https://www.xiaohongque.com)（或先注册免费账号）。
2. 进入 **设置 → 账户 → API 密钥**。
3. 点击 **「+ 创建密钥」**，填写一个便于识别的名称（如「我的脚本」「第三方集成」），权限默认包含：
   - `生成`
   - `任务查询`
4. 点击创建后，系统**仅展示一次**明文密钥（形如 `sk_…`）。请立即**复制并妥善保存**，关闭后无法再次查看。

> 列表中只显示掩码前缀（如 `xhq_sk_••••••••`）、状态（有效 / 已撤销）、权限标签以及创建/最近使用时间。

### 二、接入你的智能体

最简单的安装方式，是让智能体自己来完成。打开你的智能体应用（CodeBuddy、Claude、Cursor 或任意兼容客户端），直接对它说：

> "Guide me through installing this skill: https://github.com/xiaohongque/xhq-skill-media-generator"

智能体会自动把仓库克隆到正确的技能目录并完成配置——无需手动复制文件。然后，把你的 API Key 交给它，让它能够鉴权调用：

```
XHQ_API_KEY  = sk_…          # 来自第一步
# XHQ_API_BASE 可选（默认 https://app.xiaohongque.com）
```

安装完成后，智能体会代你调用 REST API，雀豆 从你的账户中扣除。打开网页端的 雀豆明细 即可看到每一次智能体的消耗。

### 三、安全管理

- **密钥等同于账号**：切勿分享或提交到代码仓库。
- **随时撤销**：在密钥列表点击「撤销」即可立即失效；若怀疑泄露，先撤销再新建。
- **作用域收敛**：当前默认仅 `生成 + 任务查询` 两类权限，遵循最小权限原则。
- 密钥解析回同一账号，雀豆消耗会自动出现在网页端的「雀豆明细」中，无需额外计费配置。

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
