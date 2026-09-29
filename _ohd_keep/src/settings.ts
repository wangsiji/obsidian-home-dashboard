import { App, Modal, PluginSettingTab, Setting, type Plugin } from "obsidian";

export interface QuickLink {
  label: string;
  target: string; // 笔记/文件夹路径 | command:命令ID | http(s):// 或 obsidian://
}

export interface HomeSettings {
  openOnStartup: boolean;
  replaceNewTab: boolean;
  recentCount: number;
  quickLinks: QuickLink[];
  dailyFolder: string;
  blocks: Record<string, boolean>;
}

export const DEFAULT: HomeSettings = {
  openOnStartup: true,
  replaceNewTab: true,
  recentCount: 8,
  quickLinks: [
    { label: "📥 收件", target: "00-Information" },
    { label: "🗂 项目", target: "01-Projects" },
    { label: "🌱 成长", target: "00-Growth" },
    { label: "🧠 常识", target: "03-Resources" },
  ],
  dailyFolder: "Daily",
  blocks: { search: true, quick: true, recent: true, todo: true, backlog: true, board: true },
};

export function normalize(data: unknown): HomeSettings {
  const s = { ...DEFAULT, ...(data && typeof data === "object" ? data : {}) } as HomeSettings;
  s.recentCount = Number.isInteger(s.recentCount) ? Math.min(20, Math.max(3, s.recentCount)) : 8;
  s.quickLinks = Array.isArray(s.quickLinks)
    ? s.quickLinks.filter((q) => q && typeof q.label === "string" && typeof q.target === "string")
    : [...DEFAULT.quickLinks];
  s.dailyFolder = s.dailyFolder?.trim() || "Daily";
  s.blocks = { ...DEFAULT.blocks, ...(s.blocks && typeof s.blocks === "object" ? s.blocks : {}) };
  return s;
}

/** Modal editing one quick link's label + target. */
class LinkModal extends Modal {
  constructor(
    app: App,
    private tab: HomeSettingTab,
    private save: (link: QuickLink) => void,
    private link: QuickLink,
  ) { super(app); }

  onOpen(): void {
    this.contentEl.empty();
    this.contentEl.createEl("h3", { text: "编辑快捷入口" });
    new Setting(this.contentEl).setName("名称")
      .addText((t) => t.setValue(this.link.label).onChange((v) => { this.link.label = v; }));
    new Setting(this.contentEl).setName("目标")
      .addText((t) => t.setValue(this.link.target).onChange((v) => { this.link.target = v; }));
    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText("保存").setCta().onClick(() => { this.save(this.link); this.close(); }));
  }
  onClose(): void { this.contentEl.empty(); }
}

export class HomeSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    plugin: Plugin,
    private get: () => HomeSettings,
    private onChange: (s: HomeSettings) => void,
  ) { super(app, plugin); }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Home Dashboard" });

    new Setting(containerEl).setName("启动时打开首页").setDesc("Obsidian 启动后自动打开本首页")
      .addToggle((t) => t.setValue(this.get().openOnStartup).onChange((v) => { this.get().openOnStartup = v; this.save(); }));
    new Setting(containerEl).setName("接管空白新标签页").setDesc("新建空白标签页时自动显示首页")
      .addToggle((t) => t.setValue(this.get().replaceNewTab).onChange((v) => { this.get().replaceNewTab = v; this.save(); }));
    new Setting(containerEl).setName("最近笔记数量").setDesc("最近笔记区块显示几条")
      .addSlider((sl) => sl.setLimits(3, 20, 1).setValue(this.get().recentCount).setDynamicTooltip()
        .onChange((v) => { this.get().recentCount = v; this.save(); }));
    new Setting(containerEl).setName("待办写入文件夹").setDesc("未配置每日笔记时，今日待办写入目录（默认 Daily/）")
          .addText((t) => t.setPlaceholder("Daily").setValue(this.get().dailyFolder)
            .onChange((v) => { this.get().dailyFolder = v.trim() || "Daily"; this.save(); }));

        containerEl.createEl("h3", { text: "显示区块（可插拔）" });
        const blockMeta: Array<[string, string]> = [
          ["search", "搜索栏"],
          ["quick", "快捷面板"],
          ["recent", "最近笔记"],
          ["todo", "今日待办"],
          ["backlog", "未完成任务（全库）"],
          ["board", "全景看板"],
        ];
        for (const [key, label] of blockMeta) {
          new Setting(containerEl).setName(label)
            .addToggle((t) => t.setValue(this.get().blocks[key] !== false)
              .onChange((v) => { this.get().blocks[key] = v; this.save(); }));
        }

    containerEl.createEl("h3", { text: "快捷入口" });
    containerEl.createEl("p", { text: "target：笔记/文件夹路径、command:命令ID、http(s):// 或 obsidian://。点名称或目标可编辑。", cls: "setting-item-description" });

    const refresh = () => this.display();
    this.get().quickLinks.forEach((link, i) => {
      new Setting(containerEl)
        .setName(link.label).setDesc(link.target)
        .addExtraButton((b) => b.setIcon("pencil").setTooltip("编辑").onClick(() => {
          void new LinkModal(this.app, this, (l) => { Object.assign(this.get().quickLinks[i], l); this.save(); refresh(); }, link).open();
        }))
        .addExtraButton((b) => b.setIcon("trash").setTooltip("删除").onClick(() => {
          this.get().quickLinks.splice(i, 1);
          this.save();
          refresh();
        }));
    });
    new Setting(containerEl).addButton((b) => b.setButtonText("＋ 添加入口").setCta().onClick(() => {
      const link: QuickLink = { label: "新入口", target: "" };
      this.get().quickLinks.push(link);
      void new LinkModal(this.app, this, () => { this.save(); this.display(); }, link).open();
    }));
  }

  save(): void { this.onChange(this.get()); }
}