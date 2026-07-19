import { FileSystemAdapter, Menu, Notice, Plugin, normalizePath } from "obsidian";
import * as path from "node:path";
import { LocalStorageSettings } from "./localStorageSettings";
import { PeriodicSync } from "./periodicSync";
import { DEFAULT_SETTINGS, type IcloudSettings } from "./settings";
import { IcloudSettingTab } from "./settingsTab";
import { IcloudStatusBar } from "./statusBar";
import { SyncQueue } from "./syncQueue";
import { cloneIcloudMd, pullIcloudMd, pushIcloudMd, reauthenticateIcloudMd, statusIcloudMd } from "./icloudMdClient";

export type SyncState =
	| { kind: "disconnected" }
	| { kind: "idle"; pendingCount?: number }
	| { kind: "syncing"; label: string }
	| { kind: "error"; message: string };

export default class IcloudPlugin extends Plugin {
	settings: IcloudSettings;
	localStorage: LocalStorageSettings;
	syncState: SyncState = { kind: "disconnected" };

	private readonly syncQueue = new SyncQueue();
	private statusBar: IcloudStatusBar;
	periodicSync: PeriodicSync;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.localStorage = new LocalStorageSettings(this);
		this.syncState = this.settings.connected ? { kind: "idle" } : { kind: "disconnected" };

		this.periodicSync = new PeriodicSync(this);
		this.statusBar = new IcloudStatusBar(this);
		this.addSettingTab(new IcloudSettingTab(this.app, this));

		this.addRibbonIcon("cloud", "iCloud notes sync", (evt) => this.buildActionMenu().showAtMouseEvent(evt));

		this.addConnectedCommand("pull-now", "Pull now", () => this.pull());
		this.addConnectedCommand("push-now", "Push now", () => this.push());
		this.addConnectedCommand("reauthenticate", "Reauthenticate", () => this.reauthenticate());
		this.addConnectedCommand("show-status", "Show status", () => this.showStatus());

		this.periodicSync.reload();
	}

	onunload(): void {
		this.periodicSync?.stop();
	}

	/** Registers a command that only appears/runs while a folder is connected. Using
	 * checkCallback hides it from the command palette when disconnected, rather than
	 * surfacing a "connect first" notice after the fact. */
	private addConnectedCommand(id: string, name: string, action: () => Promise<void>): void {
		this.addCommand({
			id,
			name,
			checkCallback: (checking) => {
				if (!this.settings.connected) {
					return false;
				}
				if (!checking) {
					void action();
				}
				return true;
			},
		});
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) as Partial<IcloudSettings>);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/** This plugin is desktop-only, so the adapter is always a FileSystemAdapter. */
	getVaultBasePath(): string {
		const adapter = this.app.vault.adapter;
		if (!(adapter instanceof FileSystemAdapter)) {
			throw new Error("obsidian-icloud-notes requires the desktop file system adapter");
		}
		return adapter.getBasePath();
	}

	getTargetDir(): string {
		return path.join(this.getVaultBasePath(), normalizePath(this.settings.folder));
	}

	buildActionMenu(): Menu {
		const menu = new Menu();
		menu.addItem((item) => item.setTitle("Pull now").setIcon("download").onClick(() => void this.pull()));
		menu.addItem((item) => item.setTitle("Push now").setIcon("upload").onClick(() => void this.push()));
		menu.addItem((item) =>
			item.setTitle("Reauthenticate").setIcon("key").onClick(() => void this.reauthenticate()),
		);
		menu.addItem((item) => item.setTitle("Show status").setIcon("info").onClick(() => void this.showStatus()));
		return menu;
	}

	/** The settings tab's Connect button - runs `clone`, and on success flips the plugin
	 * into the "connected" state. Returns whether it succeeded, so the settings tab knows
	 * whether to re-render into the connected view. */
	async connect(): Promise<boolean> {
		const targetDir = this.getTargetDir();
		this.setSyncState({ kind: "syncing", label: "Connecting" });
		const result = await this.syncQueue.run(() => cloneIcloudMd(this, targetDir));
		if (result.ok === false) {
			new Notice(`iCloud connect failed: ${result.error.message}`);
			this.setSyncState({ kind: "error", message: result.error.message });
			return false;
		}
		this.settings.connected = true;
		await this.saveSettings();
		this.periodicSync.reload();
		new Notice(`iCloud: cloned ${result.data.written} note(s) into ${this.settings.folder}.`);
		this.setSyncState({ kind: "idle" });
		return true;
	}

	/** Plugin-local only: forgets the binding and stops auto-sync. Leaves the cloned files
	 * and iCloud-side auth untouched. */
	disconnect(): void {
		this.settings.connected = false;
		void this.saveSettings();
		this.periodicSync.reload();
		this.setSyncState({ kind: "disconnected" });
	}

	async pull(): Promise<void> {
		if (!this.requireConnected()) {
			return;
		}
		this.setSyncState({ kind: "syncing", label: "Pulling" });
		const result = await this.syncQueue.run(() => pullIcloudMd(this, this.getTargetDir()));
		if (result.ok === false) {
			new Notice(`iCloud pull failed: ${result.error.message}`);
			this.setSyncState({ kind: "error", message: result.error.message });
			return;
		}
		new Notice(
			`iCloud pull: ${result.data.added} added, ${result.data.updated} updated, ${result.data.removed} removed.`,
		);
		await this.refreshStatus();
	}

	async push(): Promise<void> {
		if (!this.requireConnected()) {
			return;
		}
		this.setSyncState({ kind: "syncing", label: "Pushing" });
		const result = await this.syncQueue.run(() => pushIcloudMd(this, this.getTargetDir()));
		if (result.ok === false) {
			new Notice(`iCloud push failed: ${result.error.message}`);
			this.setSyncState({ kind: "error", message: result.error.message });
			return;
		}
		new Notice(`iCloud push: ${result.data.pushed ?? 0} note(s) pushed.`);
		await this.refreshStatus();
	}

	async reauthenticate(): Promise<void> {
		if (!this.requireConnected()) {
			return;
		}
		new Notice("iCloud: opening a browser window for sign-in...");
		const result = await this.syncQueue.run(() => reauthenticateIcloudMd(this, this.getTargetDir()));
		if (result.ok === false) {
			new Notice(`iCloud reauthenticate failed: ${result.error.message}`);
			return;
		}
		new Notice(`iCloud: reauthenticated as ${result.data.appleId}.`);
	}

	async showStatus(): Promise<void> {
		if (!this.requireConnected()) {
			return;
		}
		await this.refreshStatus();
		const state = this.syncState;
		if (state.kind === "idle") {
			new Notice(
				state.pendingCount ? `iCloud: ${state.pendingCount} change(s) pending.` : "iCloud: up to date.",
			);
		} else if (state.kind === "error") {
			new Notice(`iCloud: ${state.message}`);
		}
	}

	/** Called on the auto-sync interval - pull then push, both through the same queue every
	 * manual action uses, so a scheduled and a manual run never overlap. */
	async runAutoSync(): Promise<void> {
		if (!this.settings.connected) {
			return;
		}
		await this.pull();
		await this.push();
	}

	private async refreshStatus(): Promise<void> {
		const result = await this.syncQueue.run(() => statusIcloudMd(this, this.getTargetDir()));
		if (result.ok === false) {
			this.setSyncState({ kind: "error", message: result.error.message });
			return;
		}
		this.setSyncState({ kind: "idle", pendingCount: result.data.entries.length });
	}

	private requireConnected(): boolean {
		if (!this.settings.connected) {
			new Notice("iCloud notes sync: connect a folder first (see plugin settings).");
			return false;
		}
		return true;
	}

	private setSyncState(state: SyncState): void {
		this.syncState = state;
		this.statusBar?.refresh();
	}
}
