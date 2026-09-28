# Obsidian Home Dashboard

一个把 Obsidian 变成**命令中枢**的首页工作台。提供两种形态：

- **① Obsidian 插件（仓库当前形态）**：`Home Dashboard`，一个专属首页页签。
- **② Markdown 模板（零依赖兜底）**：`templates/` 下的 `Home.md` / `Home-simple.md`。

---

## ① 插件：Home Dashboard

一个真正的 Obsidian 插件：新建「首页工作台」视图，打开 Obsidian 第一眼是今天的待办和常用入口，而不是昨天随手关掉的那页。

### 五个核心块

| 块 | 作用 |
| --- | --- |
| 🔍 **搜索** | 输入 → `Enter` 打开匹配笔记，否则落全局搜索；`Shift+Enter` 把输入记成今日待办 |
| ✅ **今日待办** | 读今日日记里的 `- [ ]`，勾选即写回；`＋` 或 `Shift+Enter` 追加一条 |
| 🕐 **最近笔记** | 最近修改的 N 条笔记，点击直达 |
| 📁 **三支柱导航** | 健康 / 生活 / 价值 一键跳转 |
| ⚡ **快捷入口** | 可配置的笔记 / 文件夹 / 命令 / 链接入口 |

今日待办默认写入 `Daily/<今天>.md`（跟随 Obsidian「每日笔记」的目录/格式/模板；未配置时用 `Daily/` + `YYYYMMDD`）。

### 安装

1. 把 `main.js`、`styles.css`、`manifest.json` 复制到 `.obsidian/plugins/obsidian-home-dashboard/`。
2. 在 **设置 → 第三方插件 → 已安装** 里**启用** Home Dashboard。
3. 命令面板运行「打开首页工作台」，或点左侧 🏠。

> 启用后默认接管空白新标签页、启动自动打开（均可设置关闭）。

### 开发

```bash
npm install
node esbuild.config.mjs production   # 产物: main.js
```

## ② 模板（可选）

| 文件 | 说明 |
| --- | --- |
| `templates/Home.md` | Dataview 数据驱动版：今日任务、未来7天、项目、最近、统计 |
| `templates/Home-simple.md` | 零插件静态版：手维护，兜底 |
| `.obsidian/snippets/dashboard.css` | `cssclasses: dashboard` 多栏布局 |

详见 [docs/setup.md](docs/setup.md)。

## License

MIT License（见 [LICENSE](LICENSE)）。