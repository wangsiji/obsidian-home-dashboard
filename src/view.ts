import { ItemView, Notice, TFile, WorkspaceLeaf, normalizePath, type App } from "obsidian";
import { appendLine, ensureTodayNote, todayPath } from "./daily";
import type { HomeSettings } from "./settings";
import { buildBoard, renderBoardMatrix, quickTargets } from "./board";

export const HOME_VIEW_TYPE = "obsidian-home-dashboard";

const taskRe = /^(\s*[-*+])\s+\[( |x|X)\]\s?(.*)$/;

/** Find the line range (start..end indices) of the first `## title` / `# title` section. */
function findSection(content: string, title: string): { start: number; end: number } | null {
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!/^#{1,2}\s/.test(lines[i])) continue;
    if (lines[i].replace(/^#+\s*/, "").trim() !== title) continue;
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) if (/^#{1,2}\s/.test(lines[j])) { end = j; break; }
    return { start: i, end };
  }
  return null;
}

export class HomeView extends ItemView {
  private searchEl?: HTMLInputElement;
  private todoEl?: HTMLElement;
  private backlogEl?: HTMLElement;
  private recentEl?: HTMLElement;
  private quickEl?: HTMLElement;
  private boardEl?: HTMLElement;

  constructor(
    leaf: WorkspaceLeaf,
    private getSettings: () => HomeSettings,
  ) {
    super(leaf);
  }

  getViewType(): string { return HOME_VIEW_TYPE; }
  getDisplayText(): string { return "首页工作台"; }
  getIcon(): string { return "house"; }

  /** 按时段问候。 */
  private greeting(): string {
    const h = new Date().getHours();
    if (h < 6) return "夜深了";
    if (h < 9) return "早上好";
    if (h < 12) return "上午好";
    if (h < 14) return "中午好";
    if (h < 18) return "下午好";
    return "晚上好";
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ohd-home");

    const b = (k: string) => this.getSettings().blocks[k] !== false;

    // Hero：问候 + 日期 + 周信息
    const hero = contentEl.createDiv({ cls: "ohd-hero" });
    const dateBox = hero.createDiv({ cls: "ohd-hero-date" });
    dateBox.createDiv({ cls: "ohd-hero-greeting", text: this.greeting() });
    const today = new Date();
    const dateStr = today.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
    dateBox.createDiv({ cls: "ohd-hero-meta", text: dateStr });
    hero.createDiv({ cls: "ohd-hero-tagline", text: "把注意力放回最重要的事。" });

    // Top: search bar
    if (b("search")) {
      const head = contentEl.createDiv({ cls: "ohd-head" });
      head.createSpan({ cls: "ohd-logo", text: "🏠" });
      this.searchEl = head.createEl("input", {
        type: "text", cls: "ohd-search",
        attr: { placeholder: "搜笔记  Enter；Shift+Enter 记今日待办" },
      });
      this.searchEl.addEventListener("keydown", (e) => void this.onSearchKey(e));
    }

    // Pillar nav（跟随 search：三支柱导航是搜索的走查入口）
    if (b("search")) {
      const nav = contentEl.createDiv({ cls: "ohd-nav" });
      for (const [label, path] of [["健康", "10-健康"], ["生活", "20-生活"], ["价值", "30-价值"]] as const) {
        const bk = nav.createEl("button", { cls: "ohd-pill", text: label });
        bk.addEventListener("click", () => this.openNote(path));
      }
    }

    // Recent notes
    if (b("recent")) {
      const recent = contentEl.createDiv({ cls: "ohd-section ohd-span-6" });
      recent.createEl("div", { cls: "ohd-h2", text: "最近笔记" });
      this.recentEl = recent.createDiv({ cls: "ohd-list" });
    }

    // Vault-wide backlog
    if (b("backlog")) {
      const backlog = contentEl.createDiv({ cls: "ohd-section ohd-span-6" });
      backlog.createEl("div", { cls: "ohd-h2", text: "未完成任务 (全库)" });
      this.backlogEl = backlog.createDiv({ cls: "ohd-todo" });
    }

    // Quick links (原 Script-GlobalBoard 快捷面板)
    if (b("quick")) {
      const quick = contentEl.createDiv({ cls: "ohd-section ohd-span-5" });
      quick.createEl("div", { cls: "ohd-h2", text: "快捷面板" });
      this.quickEl = quick.createDiv({ cls: "ohd-chips" });
    }

    // Today's todos
    if (b("todo")) {
      const todo = contentEl.createDiv({ cls: "ohd-section ohd-span-7" });
      const todoHead = todo.createDiv({ cls: "ohd-h2" });
      todoHead.createSpan({ text: "今日待办" });
      todoHead.createEl("button", { cls: "ohd-mini", text: "＋" }).addEventListener("click", () => void this.addTodoPrompt());
      todoHead.createEl("button", { cls: "ohd-mini", text: "📄" }).addEventListener("click", () => void this.openTodayNote());
      this.todoEl = todo.createDiv({ cls: "ohd-todo" });
    }

    // 全景看板 (原 Script-GlobalBoard 矩阵)
    if (b("board")) {
      const board = contentEl.createDiv({ cls: "ohd-section ohd-span-12 ohd-board-section" });
      const boardHead = board.createDiv({ cls: "ohd-h2" });
      boardHead.createSpan({ text: "全景看板 · 主线×领域" });
      boardHead.createEl("button", { cls: "ohd-mini", text: "🔄" }).addEventListener("click", () => void this.renderBoard());
      this.boardEl = board.createDiv({ cls: "ohd-board" });
    }

    // Live updates
    this.registerEvent(this.app.vault.on("modify", () => void Promise.all([this.renderTodo(), this.renderBacklog(), this.renderBoard()])));
    this.registerEvent(this.app.vault.on("create", () => void Promise.all([b("recent") ? this.renderRecent() : Promise.resolve(), this.renderBacklog(), this.renderBoard()])));
    this.registerEvent(this.app.workspace.on("layout-change", () => void this.renderRecent()));

    // Initial render
    await this.renderAll();
  }

  async onClose(): Promise<void> { this.contentEl.empty(); }

  /** Re-render the whole body. Called when the plugin re-reads settings. */
  async renderAll(): Promise<void> {
    this.renderQuick();
    await Promise.all([this.renderRecent(), this.renderTodo(), this.renderBacklog(), this.renderBoard()]);
  }

  /** Focus the search bar (used by the "capture" command). */
  focusSearch(): void {
    if (this.searchEl) { this.searchEl.focus(); this.searchEl.select(); }
  }

  private async renderRecent(): Promise<void> {
    if (!this.recentEl) return;
    const s = this.getSettings();
    const files = this.app.vault.getMarkdownFiles()
      .filter((f) => !f.path.startsWith(".obsidian") && !f.path.startsWith("Daily/"))
      .sort((a, b) => b.stat.mtime - a.stat.mtime)
      .slice(0, s.recentCount);
    this.recentEl.empty();
    for (const file of files) {
      const row = this.recentEl.createDiv({ cls: "ohd-row" });
      const name = file.basename;
      const dir = file.parent?.path && file.parent.path !== "/" ? file.parent.path : "";
      row.createSpan({ cls: "ohd-fname", text: name });
      row.createSpan({ cls: "ohd-fpath", text: dir });
      row.addEventListener("click", () => void this.openPathSafe(file.path));
    }
  }

  private renderQuick(): void {
    if (!this.quickEl) return;
    this.quickEl.empty();
    const targets = quickTargets();
    for (const [label, target] of Object.entries(targets)) {
      const chip = this.quickEl.createEl("button", { cls: "ohd-chip", text: label });
      chip.addClass("ohd-chip-nav");
      chip.addEventListener("click", () => void this.openQuickTarget(target));
    }
  }

  /** 打开快捷面板目标：http(s) 用窗口，其余按笔记/文件夹解析。 */
  private async openQuickTarget(target: string): Promise<void> {
    if (/^https?:\/\//i.test(target)) { window.open(target); return; }
    await this.openPathSafe(target);
  }

  private async renderTodo(): Promise<void> {
    if (!this.todoEl) return;
    const path = await todayPath(this.app);
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      this.todoEl.empty();
      this.todoEl.createSpan({ cls: "ohd-hint", text: "今天还没有待办。用上面的 ＋ 或 Shift+Enter 记一条。" });
      return;
    }
    const content = await this.app.vault.read(file);
    const lines = content.split("\n");
    const open: Array<{ i: number; text: string }> = [];
    for (let i = 0; i < lines.length; i++) {
      const m = taskRe.exec(lines[i]);
      if (m && m[2] !== "x" && m[2] !== "X") open.push({ i, text: m[3] });
    }
    this.todoEl.empty();
    if (open.length === 0) {
      this.todoEl.createSpan({ cls: "ohd-hint", text: "全部完成！🎉" });
      return;
    }
    for (const t of open) {
      const row = this.todoEl.createDiv({ cls: "ohd-row" });
      const box = row.createEl("input", { type: "checkbox", cls: "ohd-check" });
      box.addEventListener("change", () => void this.toggleTodo(file, t.i, true));
      row.createSpan({ cls: "ohd-fname", text: t.text });
    }
  }

  /** Flip a task at line index in the daily note; also honour unchecked→checked write-back. */
  private async toggleTodo(file: TFile, lineIndex: number, done: boolean): Promise<void> {
    await this.app.vault.process(file, (c) => {
      const lines = c.split("\n");
      if (lineIndex < 0 || lineIndex >= lines.length) return c;
      const m = taskRe.exec(lines[lineIndex]);
      if (!m) return c;
      // preserve indent & bullet; only flip checkbox
      const mark = done ? "x" : " ";
      lines[lineIndex] = `${m[1]} [${mark}] ${m[3]}`;
      return lines.join("\n");
    });
    void this.renderTodo();
    void this.renderBacklog();
  }

  /** Collect every open `- [ ]` task across the vault with its file + line. */
  private async getOpenTasks(): Promise<Array<{ file: TFile; line: number; text: string }>> {
    const out: Array<{ file: TFile; line: number; text: string }> = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (file.path.startsWith(".obsidian")) continue;
      const content = await this.app.vault.cachedRead(file);
      if (content.indexOf("[ ]") === -1) continue;
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const m = taskRe.exec(lines[i]);
        if (m && m[2] !== "x" && m[2] !== "X") out.push({ file, line: i, text: m[3] });
      }
    }
    return out;
  }

  /** Render vault-wide unfinished tasks, grouped by top-level folder, capped for readability. */
  private async renderBacklog(): Promise<void> {
    if (!this.backlogEl) return;
    const tasks = await this.getOpenTasks();
    this.backlogEl.empty();
    if (tasks.length === 0) {
      this.backlogEl.createSpan({ cls: "ohd-hint", text: "全库没有未完成任务 🎉" });
      return;
    }
    const cap = 6; // folders per screen; skip the rest silently (one-glance rule)
    const byFolder = new Map<string, typeof tasks>();
    for (const t of tasks) {
      const root = t.file.path.split("/")[0];
      const key = root === t.file.basename && (root === "10-健康" || root === "20-生活" || root === "30-价值") ? "支柱" : root;
      if (!byFolder.has(key)) byFolder.set(key, []);
      byFolder.get(key)!.push(t);
    }
    const top = [...byFolder.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, cap);
    for (const [folder, items] of top) {
      const head = this.backlogEl.createDiv({ cls: "ohd-bfolder", text: `${folder} · ${items.length}` });
      head.addEventListener("click", () => void this.openFolder(folder));
      const shown = items.slice(0, 5);
      for (const t of shown) {
        const row = this.backlogEl.createDiv({ cls: "ohd-row" });
        const box = row.createEl("input", { type: "checkbox", cls: "ohd-check" });
        box.addEventListener("change", () => void this.toggleTodo(t.file, t.line, box.checked));
        row.createSpan({ cls: "ohd-fname", text: t.text });
        row.createSpan({ cls: "ohd-fpath", text: t.file.basename });
        row.addEventListener("click", () => void this.openTask(t.file, t.line));
      }
    }
    const extra = tasks.length - top.reduce((n, [, items]) => n + items.length, 0);
    if (extra > 0) this.backlogEl.createSpan({ cls: "ohd-hint", text: `…还有 ${extra} 条在其他目录` });
  }

  /** 渲染全景看板矩阵（buildBoard 全库采集 → HTML 注入 → 绑定跳转）。 */
  private async renderBoard(): Promise<void> {
    if (!this.boardEl) return;
    this.boardEl.empty();
    this.boardEl.createSpan({ cls: "ohd-hint", text: "扫描中…" });
    try {
      const model = await buildBoard(this.app);
      this.boardEl.empty();
      this.boardEl.innerHTML = renderBoardMatrix(model);
      // 绑定内部链接点击 → 打开笔记/文件夹（matrix 用原生 data-href；任务行另有 data-task-line，单独处理）
      this.boardEl.querySelectorAll("a.internal-link[data-href]:not([data-task-line])").forEach((a) => {
        a.addEventListener("click", (e) => this.onBoardLink(e, a as HTMLAnchorElement));
      });
      this.boardEl.querySelectorAll("a.internal-link[data-task-line]").forEach((a) => {
        a.addEventListener("click", (e) => this.onBoardTaskClick(e, a as HTMLAnchorElement));
      });
    } catch (err) {
      this.boardEl.empty();
      this.boardEl.createSpan({ cls: "ohd-hint", text: `全景看板加载失败（多见结构不符）：${err instanceof Error ? err.message : err}` });
    }
  }

  /** 矩阵内部链接点击：打开笔记/文件夹/锚点。 */
  private async onBoardLink(e: Event, a: HTMLAnchorElement): Promise<void> {
    e.preventDefault(); e.stopPropagation();
    const href = a.getAttribute("data-href") || "";
    await this.openPathSafe(href);
  }

  /** 矩阵任务行点击：打开笔记并跳到任务所在行。 */
  private async onBoardTaskClick(e: Event, a: HTMLAnchorElement): Promise<void> {
    e.preventDefault(); e.stopPropagation();
    const href = a.getAttribute("data-href") || "";
    const rawLine = a.getAttribute("data-task-line");
    const line = rawLine == null || rawLine === "" ? null : parseInt(rawLine, 10);
    const file = this.app.vault.getAbstractFileByPath(normalizePath(href.split("#")[0]));
    if (file instanceof TFile) {
      await this.app.workspace.getLeaf().openFile(file, { active: true, eState: line == null ? undefined : { line } });
    } else {
      new Notice(`找不到：${href}`);
    }
  }

  /** Open a note and jump the editor cursor to the task's line. */
  private async openTask(file: TFile, line: number): Promise<void> {
    await this.app.workspace.getLeaf().openFile(file, { active: true, eState: { line } });
  }

  /** Open a vault-global search scoped to a top-level folder. */
  private async openFolder(folder: string): Promise<void> {
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: "search", state: { query: `path:"${folder}/"` } });
  }

  private async openNote(path: string): Promise<void> {
    await this.openPathSafe(path);
  }
  private async openPathSafe(path: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
    if (file instanceof TFile) await this.app.workspace.getLeaf().openFile(file);
    else new Notice(`找不到：${path}`);
  }
  private async openTodayNote(): Promise<void> {
    const file = await ensureTodayNote(this.app);
    await this.app.workspace.getLeaf().openFile(file, { active: true });
  }

  private async addTodoPrompt(): Promise<void> {
    const text = prompt("今日待办", "");
    if (!text || !text.trim()) return;
    await this.addTodoWrite(text);
  }
  private async addTodoWrite(text: string): Promise<void> {
    const file = await ensureTodayNote(this.app);
    await appendLine(this.app, file, `- [ ] ${text.trim()}`);
    void this.renderTodo();
    new Notice("已记入今日待办");
  }

  private async openTarget(target: string): Promise<void> {
    const t = target.trim();
    if (t.startsWith("command:")) {
      const cmd = t.slice("command:".length);
      // executeObsidianCommand
      (this.app as unknown as { commands?: Record<string, unknown> }).commands;
      await (this.app as unknown as App & { commands: Record<string, () => void> }).commands[cmd]?.();
      return;
    }
    if (/^(https?|obsidian):\/\//i.test(t)) {
      window.open(t);
      return;
    }
    // note / folder
    await this.openPathSafe(t);
  }

  private async onSearchKey(e: KeyboardEvent): Promise<void> {
    if (!this.searchEl) return;
    const q = this.searchEl.value.trim();
    if (e.key !== "Enter" || !q) return;
    if (e.shiftKey) {
      await this.addTodoWrite(q);
      this.searchEl.value = "";
      return;
    }
    const file = this.app.vault.getAbstractFileByPath(normalizePath(q));
    if (file instanceof TFile) {
      await this.app.workspace.getLeaf().openFile(file);
      this.searchEl.value = "";
      return;
    }
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: "search", state: { query: q } });
    this.searchEl.value = "";
    new Notice(`未找到“${q}”，已打开全局搜索`);
  }
}