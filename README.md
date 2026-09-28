# Obsidian Home Dashboard

一个**把 Obsidian Vault 变成一个"命令中枢"**的可复用首页工作台模板。打开 Obsidian 第一眼看到的是今天的任务、在走的所有、最近动过的笔记——而不是昨天随手关掉的那页。

以社区成熟的 **Dataview + Tasks + CSS grid** 范式搭建：数据自动填充，不手维护链接；一刀屏能扫完，防腐烂。

## 特性

- **双档可选**
  - `Home.md` — 数据驱动版（需 Dataview）：今日任务、未来7天、进行中项目、最近编辑、库统计，自动填充
  - `Home-simple.md` — 零插件静态版：手维护，开箱即用，适合不装 Dataview 的小库
- **多栏卡片布局** — `cssclasses: dashboard` + 一个 snippet，网格自适应到窄屏单列
- **任务语义** — 用 Tasks 插件读 📅 截止 / 🔁 循环，做今天的议程最自然
- **参数化适配** — 查询里的文件夹名/tag 集中在一处可改，不用懂 Dataview 语法也能换结构
- **抗腐烂** — 一刀屏就够；块不堆多。详见 [设计原则](docs/setup.md#设计原则)

## 快速开始（2 分钟）

1. **复制文件**：把 `templates/Home.md`（或 `Home-simple.md`）和 `.obsidian/snippets/dashboard.css` 拷进你的 Vault。
2. **启用样式**：Obsidian 设置 → 外观 → CSS 代码片段 → 启用 `dashboard`。
3. **装插件**（动态版需要）：[Dataview](https://github.com/blacksmithgu/obsidian-dataview) 打开；任务用 [Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks)。
4. **设置启动页**：装 [Homepage](https://github.com/mirnovov/obsidian-homepage) 插件，指向 `Home`（设为启动打开、强制阅读视图）。
5. **改文件夹名**：把查询里的文件夹/tag 换成你自己的（README 末尾注释标了「改这里」）。

> 想要「今日焦点」提醒？把下面这行写进你的日记模板，每天自动对齐：
> ```markdown
> ## 今日焦点
> - [ ] （今天推进最重要的一件事）[due:: 今天]
> ```

## 项目结构

```text
obsidian-home-dashboard/
├── README.md                # 本文件
├── LICENSE
├── templates/
│   ├── Home.md               # Dataview 数据驱动版（推荐）
│   └── Home-simple.md        # 零插件静态版（兜底）
├── .obsidian/snippets/
│   └── dashboard.css         # 多栏卡片布局
└── docs/
    └── setup.md              # 插件安装+配置+改文件夹 分步指南
```

## 依赖

| 能力 | 必备插件 | 版本 |
| --- | --- | --- |
| 数据驱动（`Home.md`） | Dataview | 需启用 JS 查询 |
| 任务聚合（今日/未来7天） | Tasks | 可选但不装则这两块空 |
| 启动自动打开/强阅读 | Homepage | 可选，推荐 |

`Home-simple.md` 不需要任何插件，纯手维护即可跑。

## 从旧首页迁移

已有 `index.md`/`Dashboard.md` 当首页了？——本 template 默认**不碰已有的**，直接增一份新 `Home`。想替换：先备份旧首页 → 把 `Home.md` 改名成 `index.md`（或 Dashboard）→ 再按需合并你想保留的旧链接区块。

## License

MIT License（详见 [LICENSE](LICENSE)）。