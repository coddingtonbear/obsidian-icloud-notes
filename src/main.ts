import { FileSystemAdapter, Plugin } from "obsidian";
import { LocalStorageSettings } from "./localStorageSettings";
import { DEFAULT_SETTINGS, type IcloudSettings } from "./settings";
import { IcloudSettingTab } from "./settingsTab";
import { runIcloudMdSpike } from "./spike";

export default class IcloudPlugin extends Plugin {
	settings: IcloudSettings;
	localStorage: LocalStorageSettings;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.localStorage = new LocalStorageSettings(this);

		this.addSettingTab(new IcloudSettingTab(this.app, this));

		this.addCommand({
			id: "run-auth-spike",
			name: "Run auth de-risk spike (clone test folder)",
			callback: () => void runIcloudMdSpike(this),
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
			throw new Error("obsidian-icloud requires the desktop file system adapter");
		}
		return adapter.getBasePath();
	}
}
