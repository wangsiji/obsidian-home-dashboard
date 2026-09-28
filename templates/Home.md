---
cssclasses: dashboard
aliases: ["🏠 首页", "Home", "工作台"]
---

# 🏠 工作台

> [!info] 今日
> 想清楚今天要推进的**一件事**，写在上面的 `今日焦点` 区块 (或下方任务)。Dashboard帮你找回上下文，不帮你做决定。

## ⚡ 今日焦点
- [ ] （把今天最重要的一件事放在这里，`[due::` 填今天）

---

## ✅ 今日任务
```tasks
not done
due on or before today
hide backlinks
hide edit button
sort by due
```

## 🔜 未来 7 天
```tasks
not done
due after today
due before in 7 days
hide backlinks
sort by due
```

---

## 📁 项目 (进行中)
```dataview
TABLE status AS "状态", dateformat(date(created,"yyyy-MM-dd"),"yyyy-MM-dd") AS "创建", due AS "截止"
FROM #project
WHERE status != "done" AND status != "archived"
SORT date(due) ASC
```

## 🕐 最近编辑
```dataview
LIST
FROM ""
SORT file.mtime DESC
LIMIT 8
```

## 🔢 统计一角
- 笔记总数：`$=dv.pages('""').length`
- 常青卡片：`$=dv.pages('"03-Resources/Evergreen"').length`
- 今日已创建：`$=dv.pages('""').where(p => p.file.ctime && moment(p.file.ctime).isSame(moment(),'day')).length`

---

## 🧭 导航
- **三支柱**：[[10-健康]] · [[20-生活]] · [[30-价值]]
- **实现层**：[[01-Projects]] · [[02-Areas]] · [[03-Resources]]
- **数据层**：[[00-Growth]] · [[00-Information]] · [[00-LLM-WiKi]] · [[00-Attachments]]