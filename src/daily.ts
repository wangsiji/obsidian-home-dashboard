import { TFile, moment, normalizePath, type App } from "obsidian";

const now = moment as unknown as () => { format(p: string): string };

interface DailyOptions { folder?: string; format?: string; template?: string }

/** Read the host Daily notes core-plugin settings (folder/format/template), no-op when off. */
export async function dailyOptions(app: App): Promise<DailyOptions> {
  const runtime = (app as App & {
    internalPlugins?: { getPluginById?(id: string): { instance?: { options?: unknown } } | null };
  }).internalPlugins?.getPluginById?.("daily-notes")?.instance?.options;
  const path = `${app.vault.configDir}/daily-notes.json`;
  try {
    const value: unknown = runtime ?? (
      await app.vault.adapter.exists(path) ? JSON.parse(await app.vault.adapter.read(path)) : {}
    );
    if (!value || typeof value !== "object") throw new Error();
    return value as DailyOptions;
  } catch {
    return {};
  }
}

/** Path of today's daily note: `folder/<format>.md`, defaulting to Daily/YYYYMMDD. */
export async function todayPath(app: App): Promise<string> {
  const o = await dailyOptions(app);
  const format = typeof o.format === "string" && o.format ? o.format : "YYYYMMDD";
  const folder = typeof o.folder === "string" ? o.folder.trim() : "Daily";
  return normalizePath(`${folder}/${now().format(format)}.md`);
}

async function ensureParent(app: App, path: string): Promise<void> {
  const parts = path.split("/").slice(0, -1);
  for (let i = 1; i <= parts.length; i++) {
    const folder = parts.slice(0, i).join("/");
    if (!(await app.vault.adapter.exists(folder))) {
      try { await app.vault.createFolder(folder); } catch { if (!(await app.vault.adapter.exists(folder))) throw new Error("无法创建目录"); }
    }
  }
}

/** Today's daily note, created from the daily template when missing. Never overwrites an existing note. */
export async function ensureTodayNote(app: App): Promise<TFile> {
  const path = await todayPath(app);
  await ensureParent(app, path);
  let file = app.vault.getAbstractFileByPath(`${path}.md`);
  if (!file) {
    const o = await dailyOptions(app);
    let initial = "";
    const tp = typeof o.template === "string" && o.template.trim() ? o.template : "";
    if (tp) {
      const t = app.vault.getAbstractFileByPath(normalizePath(tp.endsWith(".md") ? tp : `${tp}.md`));
      if (t instanceof TFile) initial = (await app.vault.read(t)).replace(
        /{{date(?::[^}]+)?|{{time(?::[^}]+)?|{{title}}/gi,
        (_, token: string) => token.startsWith("{{time") ? now().format("HH:mm")
          : token.startsWith("{{date") ? now().format("YYYY-MM-DD") : path.split("/").pop() ?? "note"
      );
    }
    try { file = await app.vault.create(`${path}.md`, initial); }
    catch { file = app.vault.getAbstractFileByPath(`${path}.md`); if (!file) throw new Error("无法创建今日笔记"); }
  }
  if (!(file instanceof TFile)) throw new Error("今日笔记路径不正确");
  return file;
}

/** Open today's daily note in a leaf. */
export async function openTodayNote(app: App, leaf: import("obsidian").WorkspaceLeaf): Promise<void> {
  await leaf.openFile(await ensureTodayNote(app), { active: true });
}

/** In-place append a raw markdown block to a file. */
export async function appendLine(app: App, file: TFile, line: string): Promise<void> {
  await app.vault.process(file, (c) => `${c}${c && !c.endsWith("\n") ? "\n" : ""}${line}\n`);
}