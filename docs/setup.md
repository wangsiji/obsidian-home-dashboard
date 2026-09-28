# 完整安装与配置指南

本指南无废话，为「装完就能用」优化。每一步都有清晰的「为什么」。

---

## 1. 安装三个插件（按需）

| 插件 | 用途 | 为什么需要 |
| --- | --- | --- |
| **Dataview** | 从后台字段实时查笔记 | `Home.md` 的所有动态块都由它驱动 |
| **Tasks** | 聚合带日期的 checkbox | 今天的任务议程、循环事件，看日期最自然 |
| **Homepage** | 启动时自动打开首页 | 冷启动落在仪表盘而非上一页 |

安装路径：`设置 → 社区插件 → 浏览`，搜名字安装并**启用**。

---

## 2. 启用 CSS snippet

把仓库里的 `.obsidian/snippets/dashboard.css` 复制进你 Vault 的
`.obsidian/snippets/` 目录，然后：

```
设置 → 外观 → CSS 代码片段 → 刷新 → 打开「dashboard」
```

若在 `外观 → CSS 代码片段` 里看不到，先点「刷新/文件夹图标」再勾选。

---

## 3. 复制仪表盘笔记

把 `templates/Home.md`（或想要纯手维护的 `Home-simple.md`）复制到 Vault 根目录。

等下：**两档怎么选？**

- **想要零依赖、马上能跑** → `Home-simple.md`（手维护链接即可）
- **想让它自己填数据、长期省事** → `Home.md`（依赖 Dataview+Tasks）

`Home.md` 的扫地自己填；`Home-simple` 各区块留了「手动补」提示。

---

## 4. 配置 Dataview

必开的一项：`设置 → Dataview → 启用 JavaScript 查询`。没有它，`$=dv.pages(...)` 统计行和自定义块会失效。

- 若你只需要「最近编辑/表格/列表」，可以不装 Tasks，只留 Dataview。
- 若要「今日任务」区块滚动，必须装 Tasks——它原生理解 📅/🔁/⏳。

---

## 5. 配置 Homepage 插件（可选但推荐）

```
设置 → 社区插件 → Homepage
```

- 「主页类型」→ File
- 「文件」→ 指向你的 `Home.md`
- 开「启动时打开」
- 「阅读视图」→ 建议开（让 Dataview 渲染成内容而非代码）

这样每次开 Obsidian 都落在仪表盘，而不是昨天关的那页。

---

## 6. 把查询改成你自己的结构

模板默认按一套常见结构写（`03-Resources/Evergreen`、`01-Projects`、tag `#project`）。
你的 Vault 文件夹 / tag 不一样时，打开 `Home.md`，直接改这几处：

```dataview
TABLE status AS "状态", date(created) AS "创建", due AS "截止"
FROM #project           ← 改成你的项目 tag（如 #p / #项目）
WHERE status != "done"
```

任务块不用改（Tasks 依日期自动聚合，跨全库）。唯一要注意的：**空文件夹查询要带限制（LIMIT）**，养成习惯省得卡。

---

## 设计原则（为什么这么搭）

- **一刀屏就够**。扫不完说明块多了，删。
- **按意图分组**：`Do`（任务）/ `Navigate`（导航）/ `Review`（最近+统计）。把每天最常盯的放左上角——那里人最先看。
- **为今天服务，不给上周贴金**。一个块如果不能帮你做 9:00 的决定，就该删。
- **给任务加日期**：`- [ ] 改主页 [due:: 2026-09-22]`——Dashboard用它自动排今日与未来议程。这是让整张数据块动起来的最小习惯。

---

## 常见问题（FAQ）

**问：模板文件复制到 Obsidian 没反应？**
答：确认 `.obsidian/snippets/dashboard.css` 已复制进 Vault 的 snippets 目录并**启用**；且 `Home.md` 的 frontmatter 里 `cssclasses: dashboard` 这一行不能丢——多栏布局靠它触发。

**问：首页打出来是「代码块」不是表格？**
答：多半是 Live Preview / Source 模式。切阅读视图，或在那一条加 `> ` 再试。

**问：重启后还是落在别的笔记？**
答：装 Homepage 插件并指向 `Home`，开「启动时打开」。没装的话 Obsidian 只重开你上次的页面。

**问：我想把 `#project` 改成别的 tag？**
答：只改 `FROM #project` 那一行即可，其余不用动。