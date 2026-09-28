import { Plugin, Workspace } from "obsidian";
import { HOME_VIEW_TYPE, HomeView } from "./view";
import { DEFAULT, HomeSettingTab, normalize, type HomeSettings } from "./settings";

export default class HomeDashboardPlugin extends Plugin {
  settings: HomeSettings = { ...DEFAULT };

  async onload(): Promise<void> {
    this.settings = normalize(await this.loadData());

    this.registerView(HOME_VIEW_TYPE, (leaf) => new HomeView(leaf, () => this.settings));
    this.addRibbonIcon("home", "首页工作台", () => void this.openHome());
    this.addCommand({ id: "open-home", name: "打开首页工作台", callback: () => void this.openHome() });
    this.addCommand({ id: "capture-todo", name: "记今日待办", callback: () => void this.captureInHome() });

    this.addSettingTab(new HomeSettingTab(this.app, this, () => this.settings, (s) => void this.saveAndRender(s)));

    this.app.workspace.onLayoutReady(() => {
      if (this.settings.openOnStartup) void this.openHome({ startup: true });
      if (this.settings.replaceNewTab) this.registerEvent(this.app.workspace.on("layout-change", () => this.claimEmptyTabs()));
    });
  }

  onunload(): void { void 0; }

  async openHome(options: { startup?: boolean } = {}): Promise<void> {
    const workspace = this.app.workspace as Workspace;
    const current = workspace.getMostRecentLeaf();
    let leaf = current?.view.getViewType() === HOME_VIEW_TYPE ? current : null;
    if (!leaf && options.startup) leaf = workspace.getLeavesOfType(HOME_VIEW_TYPE).find((c) => c.getRoot() === workspace.rootSplit) ?? null;
    if (!leaf && current?.view.getViewType() === "empty") leaf = current;
    if (!leaf) leaf = workspace.getLeaf("tab");
    if (leaf && leaf.view.getViewType() !== HOME_VIEW_TYPE) await leaf.setViewState({ type: HOME_VIEW_TYPE, active: true });
    if (leaf) await workspace.revealLeaf(leaf);
  }

  /** 空白新标签页 → 首页。侧边栏不动。 */
  private claimEmptyTabs(): void {
    const workspace = this.app.workspace as Workspace;
    workspace.iterateAllLeaves((leaf) => {
      if (leaf.view.getViewType() !== "empty") return;
      const root = leaf.getRoot() as unknown;
      if (root === workspace.leftSplit || root === workspace.rightSplit) return;
      void leaf.setViewState({ type: HOME_VIEW_TYPE, active: false });
    });
  }

  /** 打开首页并把焦点放到搜索框，方便记待办。 */
  private async captureInHome(): Promise<void> {
    await this.openHome();
    const view = this.app.workspace.getLeavesOfType(HOME_VIEW_TYPE).at(0)?.view;
    if (view instanceof HomeView) view.focusSearch();
  }

  /** 设置变更 → 存盘 + 刷新已打开的首页。 */
  private async saveAndRender(s: HomeSettings): Promise<void> {
    this.settings = normalize(s);
    await this.saveData(this.settings);
    for (const leaf of this.app.workspace.getLeavesOfType(HOME_VIEW_TYPE)) {
      if (leaf.view instanceof HomeView) await leaf.view.renderAll();
    }
  }
}