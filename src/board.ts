/**
 * 全景看板（复现自 vault 原 Script-GlobalBoard.js，去除 Dataview 依赖）。
 * 数据全部由 app.vault + metadataCache 原生采集，无 dv。
 */
import { App, TFile } from "obsidian";

/* ── 配色令牌（源自原脚本 WB_C） ── */
export const C = {
  green: '#31845F', blue: '#476FA8', purple: '#815FA5',
  orange: '#C8753D', red: '#C44743',
  gold: '#A27D35', warm: '#A97648',
  overdue: '#d9534f', link: '#3a7afe',
};
const FONT = { xs: '11px', sm: '12px', base: '13px', md: '14px', icon: '16px' };
const OUT_ROOT = '03-Resources/Outputs';
const COLS = [5, 8, 25, 16, 26, 15, 5];

/* ── 主线 + 领域配置（源自原脚本，硬编码 wsj 库结构） ── */
const PILLARS = [
  { code: '10-健康', name: '健康', icon: 'heart', color: C.green, desc: '' },
  { code: '20-生活', name: '生活', icon: 'home', color: C.blue, desc: '' },
  { code: '30-价值', name: '价值', icon: 'gem', color: C.purple, desc: '' },
];

/* ── 纯工具函数 ── */
function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]! ));
}
function toJSDate(x: unknown): Date | null {
  if (!x) return null;
  if (x instanceof Date) return x;
  if (typeof x === 'number') { const ms = x < 1e12 ? x * 1000 : x; return new Date(ms); }
  if (typeof x === 'string') { const d = new Date(x as string); return isNaN(d.getTime()) ? null : d; }
  if (typeof x === 'object') {
    const o = x as { toMillis?: () => number; valueOf?: () => unknown; toISO?: () => unknown; ts?: unknown };
    if (typeof o.toMillis === 'function') return new Date(o.toMillis());
    if (typeof o.valueOf === 'function') {
      const v = o.valueOf();
      if (typeof v === 'number' && isFinite(v)) return new Date(v < 1e12 ? v * 1000 : v);
    }
    if (typeof o.toISO === 'function') { const d = new Date(String(o.toISO() as unknown)); return isNaN(d.getTime()) ? null : d; }
    if (o.ts && o.ts !== x) return toJSDate(o.ts);
  }
  return null;
}
function startOfToday(): Date {
  const x = new Date(); x.setHours(0, 0, 0, 0); return x;
}
function isOverdue(d: Date | null): boolean {
  return !!d && d.getTime() < startOfToday().getTime();
}
function fmtDue(d: Date | null): string {
  if (!d) return '';
  const W = ['周日','周一','周二','周三','周四','周五','周六'];
  const md = `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const today = startOfToday();
  if (d.getTime() < today.getTime()) return `逾期 ${md}`;
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff <= 0) return '今天';
  if (diff === 1) return '明天';
  if (diff < 7) return W[d.getDay()];
  return md;
}
function dueColor(d: Date | null): string {
  if (isOverdue(d)) return C.overdue;
  if (!d) return 'var(--text-faint)';
  const diff = Math.round((d.getTime() - startOfToday().getTime()) / 86400000);
  return diff <= 7 ? C.orange : 'var(--text-muted)';
}
function toStrArr(v: unknown): string[] {
  if (v == null) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.map(x => String(x).replace(/[\[\]]/g, '').replace(/\.md$/, '')).filter(Boolean);
}
/** 从笔记源解析「## 里程碑」小节 checkbox */
function extractMilestones(content: string): Array<{ text: string; done: boolean; due: string }> {
  if (!content) return [];
  const lines = content.split('\n');
  let inMs = false; const out: Array<{ text: string; done: boolean; due: string }> = [];
  for (const line of lines) {
    if (/^#+\s*里程碑\s*$/.test(line)) { inMs = true; continue; }
    if (inMs && /^#+\s/.test(line)) break;
    if (inMs) {
      const m = line.match(/^\s*[-*]\s*\[([ xX])\]\s*(.*)$/);
      if (m) {
        const dueM = m[2].match(/📅\s*(\d{4}-\d{2}-\d{2})/);
        out.push({ text: m[2].replace(/📅\s*\d{4}-\d{2}-\d{2}/, '').replace(/[\[\]]/g, '').trim(),
                   done: m[1].toLowerCase() === 'x', due: dueM ? dueM[1] : '' });
      }
    }
  }
  return out;
}
function latestMilestone(ms: Array<{ text: string; done: boolean; due: string }>) {
  if (!ms.length) return null;
  const dated = ms.filter(m => toJSDate(m.due));
  if (!dated.length) return ms[0];
  const today = startOfToday().getTime();
  const upcoming = dated.filter(m => (toJSDate(m.due) as Date).getTime() >= today)
    .sort((a, b) => (toJSDate(a.due) as Date).getTime() - (toJSDate(b.due) as Date).getTime());
  if (upcoming.length) return upcoming[0];
  return dated.sort((a, b) => (toJSDate(b.due) as Date).getTime() - (toJSDate(a.due) as Date).getTime())[0];
}
function priorityRank(v: unknown): number {
  if (v == null || v === '') return 999;
  const s = String(v).trim();
  const m = s.match(/^P\s*(\d+)/i); if (m) return parseInt(m[1], 10);
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  if (/高/.test(s)) return 0; if (/中/.test(s)) return 1; if (/低/.test(s)) return 2;
  return 500;
}

/* ── 数据采集（替代 dv.pages/dv.page/dv.io.load） ── */
function cacheFrontmatter(app: App, path: string): Record<string, unknown> {
  try {
    const mc = (app as unknown as { metadataCache?: { getCache?: (p: string) => unknown } }).metadataCache;
    const c = mc?.getCache?.(path) as { frontmatter?: Record<string, unknown> } | undefined;
    return c?.frontmatter ?? {};
  } catch { return {}; }
}
async function readRaw(app: App, path: string): Promise<string> {
  const f = app.vault.getAbstractFileByPath(path);
  if (f instanceof TFile) { try { return await app.vault.cachedRead(f); } catch { try { return await app.vault.read(f); } catch { return ''; } } }
  return '';
}
interface Page {
  path: string; basename: string; name: string;
  category: string[]; priority: string; status: string; description: string; goal: string;
}
async function scanFolder(app: App, folder: string): Promise<Array<{ page: Page; raw: string }>> {
  const out: Array<{ page: Page; raw: string }> = [];
  for (const f of app.vault.getMarkdownFiles()) {
    if (!f.path.startsWith(folder + '/')) continue;
    const fm = cacheFrontmatter(app, f.path);
    out.push({
      page: {
        path: f.path, basename: f.basename,
        name: typeof fm.name === 'string' && fm.name ? fm.name : f.basename,
        category: toStrArr(fm.category),
        priority: typeof fm.priority === 'string' ? fm.priority : '',
        status: typeof fm.status === 'string' ? fm.status : '',
        description: typeof fm.description === 'string' ? fm.description : '',
        goal: typeof fm.goal === 'string' ? fm.goal : '',
      },
      raw: await readRaw(app, f.path),
    });
  }
  return out;
}

/* ── 模型类型 ── */
export interface Area {
  code: string; name: string; short: string; desc: string;
  pillar: string;
  projects: Array<{ name: string; path: string; status: string; priority: string; milestones: Array<{ text: string; done: boolean; due: string }> }>;
  milestones: Array<{ text: string; done: boolean; due: string; project: string; projectPath: string }>;
  works: Array<{ name: string; path: string }>;
  taskToday: Array<{ text: string; path: string; line: number; due: Date | null }>;
  review: string | null;
}
export interface BoardModel {
  areas: Area[];
  pills: typeof PILLARS;
}

/** 全库扫描采集 → 归一化模型。 */
export async function buildBoard(app: App): Promise<BoardModel> {
  const areaPages = await scanFolder(app, '02-Areas');
  const areas: Area[] = areaPages.map(({ page }) => ({
    code: page.basename,
    name: page.name || page.basename,
    short: (page.name || page.basename).replace(/^\d+-\s*/, ''),
    desc: page.description || '',
    pillar: page.category[0] || '',
    projects: [], milestones: [], works: [],
    taskToday: [], review: null,
  })).sort((a, b) => (parseInt(a.code, 10) || 0) - (parseInt(b.code, 10) || 0));
  const areaCodes = new Set(areas.map(a => a.code));
  const areaByCode = new Map(areas.map(a => [a.code, a]));

  // 项目
  for (const { page, raw } of await scanFolder(app, '01-Projects')) {
    const codes = page.category.filter(c => areaCodes.has(c));
    for (const code of codes) {
      const a = areaByCode.get(code); if (!a) continue;
      a.projects.push({
        name: page.name, path: page.path, status: page.status,
        priority: page.priority, milestones: extractMilestones(raw),
      });
    }
  }
  for (const a of areas)
    a.projects.sort((x, y) => priorityRank(x.priority) - priorityRank(y.priority) || x.name.localeCompare(y.name, 'zh'));
  for (const a of areas)
    a.milestones = a.projects.flatMap(project => {
      const l = latestMilestone(project.milestones);
      return l ? [{ ...l, project: project.name, projectPath: project.path }] : [];
    });

  // 任务（全局扫所有 md 的未完成 checkbox，路径/分类归属领域）
  for (const f of app.vault.getMarkdownFiles()) {
    if (f.path.startsWith('.obsidian')) continue;
    const raw = await readRaw(app, f.path);
    if (!raw.includes('[')) continue;
    const codes = new Set<string>();
    for (const a of areas) if (f.path.includes(a.code)) codes.add(a.code);
    if (!codes.size) for (const c of areaPages.flatMap(x => x.page.category)) if (areaCodes.has(c)) codes.add(c);
    const lines = raw.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^\s*[-*+]\s+\[(\s|x|X)\]\s*(.*)$/);
      if (!m || m[1].toLowerCase() === 'x') continue;
      const dueM = m[2].match(/📅\s*(\d{4}-\d{2}-\d{2})/);
      const due = dueM ? new Date(dueM[1] + 'T00:00:00') : null;
      const text = m[2].replace(/[📅✅⏳🎯]+\s*\d{4}-\d{2}-\d{2}/g, '')
        .replace(/\[\[([^\]|]+?)(?:\|[^\]]+?)?\]\]/g, '$1').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      for (const code of codes) {
        const a = areaByCode.get(code); if (!a) continue;
        if (due && due.getTime() < new Date(startOfToday().getTime() + 86400000).getTime())
          a.taskToday.push({ text, path: f.path, line: i, due });
      }
    }
  }
  for (const a of areas)
    a.taskToday.sort((x, y) => (x.due?.getTime() ?? Infinity) - (y.due?.getTime() ?? Infinity));

  // 作品（Outputs）
  for (const { page } of await scanFolder(app, OUT_ROOT)) {
    for (const code of page.category) {
      const a = areaByCode.get(code); if (!a) continue;
      a.works.push({ name: page.name, path: page.path });
    }
  }

  // 回顾（00-Growth/Weekly/2026W##）
  const reviewByLink = new Map<string, string>(); // token -> basename
  for (const { page, raw } of await scanFolder(app, '00-Growth/Weekly')) {
    if (!/^\d{4}W\d+$/.test(page.basename)) continue;
    const md = raw.match(/\[\[([^\]|#]+)/g) || [];
    for (const m of md) {
      const token = m.replace(/\[\[/, '').split('|')[0].split('#')[0].trim();
      if (!token) continue;
      const prev = reviewByLink.get(token);
      if (!prev || page.basename > prev) reviewByLink.set(token, page.basename);
    }
  }
  for (const a of areas) {
    const candidates = new Set([a.name, a.code, a.pillar, ...a.projects.map(p => p.name)].filter(Boolean));
    let best: string | null = null;
    for (const token of candidates) {
      const r = reviewByLink.get(token);
      if (r && (!best || best < r)) best = r;
    }
    a.review = best;
  }

  // 主线描述：读 vault 根笔记（10-健康.md 等）的 description
  for (const p of PILLARS) {
    const fm = cacheFrontmatter(app, p.code + '.md');
    if (typeof fm.description === 'string') p.desc = fm.description;
  }

  return { areas, pills: PILLARS };
}

/* ── 渲染 ── */
export function renderBoardMatrix(model: BoardModel): string {
  const { areas, pills } = model;
  const pillarOf = (p: string) => pills.find(x => x.code === p) ?? pills[0];
  const countByPillar: Record<string, number> = {};
  areas.forEach(a => { countByPillar[a.pillar] = (countByPillar[a.pillar] || 0) + 1; });

  let rows = '';
  let lastPillar: string | null = null;
  for (const a of areas) {
    const pil = pillarOf(a.pillar);
    const firstOfPillar = a.pillar !== lastPillar;
    lastPillar = a.pillar;
    const border = 'border-bottom:1px solid color-mix(in srgb,var(--background-modifier-border) 24%,transparent)';

    const pillarCell = firstOfPillar
      ? `<td rowspan="${Math.max(1, countByPillar[a.pillar])}" style="white-space:nowrap;vertical-align:middle;text-align:center;background:color-mix(in srgb,${pil.color} 2%,transparent);box-shadow:inset 2px 0 0 color-mix(in srgb,${pil.color} 65%,transparent);${border}"><div style="display:flex;flex-direction:column;align-items:center;gap:4px"><span style="color:${pil.color};font-size:${FONT.base};font-weight:750">${pil.name}</span>${pil.desc ? `<span style="font-size:${FONT.xs};color:var(--text-muted);max-width:110px;line-height:1.4">${esc(pil.desc)}</span>` : ''}</div></td>`
      : '';

    const goalHtml = a.milestones.length ? a.milestones.map(m => {
      const d = toJSDate(m.due);
      const due = d ? fmtDue(d) : '';
      const dueC = due ? `<span style="margin-left:5px;font-size:${FONT.xs};font-weight:600;color:${dueColor(d)}">${due}</span>` : '';
      return `<div style="display:flex;align-items:baseline;gap:4px;font-size:${FONT.base};line-height:1.6">${m.done ? '◆' : '◇'}<a class="internal-link" data-href="${esc(m.projectPath + '#里程碑')}" href="${esc(m.projectPath + '#里程碑')}" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-normal);text-decoration:${m.done ? 'line-through' : 'none'}">${esc(m.text)}</a>${dueC}</div>`;
    }).join('') : '';

    const projHtml = a.projects.length ? `<div style="display:flex;flex-wrap:wrap;gap:0">${a.projects.map(p =>
      `<span style="padding:0 6px;margin-top:2px;color:var(--text-normal);font-size:${FONT.base}"><a class="internal-link" data-href="${esc(p.path)}" href="${esc(p.path)}" style="text-decoration:none">${esc(p.name)}</a></span>`).join('')}</div>` : '';

    const taskHtml = a.taskToday.length ? a.taskToday.slice(0, 5).map(t => {
      const due = t.due ? fmtDue(t.due) : '';
      const dueC = due ? `<span style="margin-left:5px;font-size:${FONT.xs};color:${dueColor(t.due)};white-space:nowrap">${due}</span>` : '';
      return `<a class="internal-link" data-href="${esc(t.path)}" href="${esc(t.path)}" data-task-line="${t.line}" style="display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-normal);text-decoration:none;line-height:1.5;font-size:${FONT.base}">○ ${esc(t.text)}${dueC}</a>`;
    }).join('') : '';

    const workHtml = a.works.length ? `<div style="display:flex;flex-wrap:wrap;gap:0">${a.works.map(w =>
      `<span style="padding:0 6px;margin-top:2px;font-size:${FONT.sm};color:var(--text-muted)"><a class="internal-link" data-href="${esc(w.path)}" href="${esc(w.path)}" style="text-decoration:none">${esc(w.name)}</a></span>`).join('')}</div>` : '';

    const revHtml = a.review
      ? `<a class="internal-link" data-href="${esc('00-Growth/Weekly/' + a.review + '#' + a.code)}" href="${esc('00-Growth/Weekly/' + a.review + '#' + a.code)}" style="font-size:${FONT.sm};text-decoration:none;color:var(--text-muted)">${a.review.replace(/^\d{4}(W\d{2})$/, '$1')}</a>`
      : '';

    rows += `<tr style="vertical-align:top">
      ${pillarCell}
      <td style="${border}white-space:nowrap"><a class="internal-link" data-href="${esc(a.code)}" href="${esc(a.code)}" style="font-size:${FONT.base};font-weight:650;color:${pil.color};text-decoration:none">${a.short}</a>${a.desc ? `<div style="font-size:${FONT.xs};color:var(--text-muted);margin-top:3px;max-width:130px;line-height:1.4">${esc(a.desc)}</div>` : ''}</td>
      <td style="${border}">${goalHtml}</td>
      <td style="${border};border-left:1px solid color-mix(in srgb,var(--background-modifier-border) 24%,transparent)">${projHtml}</td>
      <td style="${border};border-left:1px solid color-mix(in srgb,var(--background-modifier-border) 24%,transparent)">${taskHtml}</td>
      <td style="${border}">${workHtml}</td>
      <td style="${border}">${revHtml}</td>
    </tr>`;
  }

  return `<div class="ohd-board-wrap" style="overflow-x:auto">
    <table class="ohd-matrix" style="width:100%;border-collapse:separate;border-spacing:0;min-width:640px;table-layout:fixed">
      <colgroup>${COLS.map(w => `<col style="width:${w}%">`).join('')}</colgroup>
      <thead><tr>${['主线','领域','里程碑','项目','任务','作品','回顾'].map(h => `<th style="text-align:left;font-size:${FONT.sm};font-weight:700;letter-spacing:.5px">${h}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

/** 快捷面板：9 个 chip 的目标地址（基于本周周号）。 */
export function quickTargets(): Record<string, string> {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const year = d.getFullYear();
  const jan4 = new Date(year, 0, 4);
  jan4.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const wk = Math.floor((d.getTime() - jan4.getTime()) / (7 * 86400000)) + 1;
  const week = `${year}W${String(wk).padStart(2, '0')}`;
  return {
    '每日总结': `00-Growth/Weekly/${week}`,
    '本周回顾': `00-Growth/Weekly/${week}#周复盘`,
    '每日一卡': '01-Projects/Doing/常青卡片',
    '每篇论文': '01-Projects/ToDo/论文',
    '每周一书': '01-Projects/Doing/阅读',
    '剪藏': '00-Attachments/Database/剪藏.base',
    '卡片': '00-Attachments/Database/常青卡片.base',
    '项目': '00-Attachments/Database/项目.base',
    '全库笔记': '00-Attachments/Database/全库笔记.base',
  };
}