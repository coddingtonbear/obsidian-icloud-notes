import { Notice, PluginSettingTab, Setting, type App, type ButtonComponent } from "obsidian";
import type IcloudPlugin from "./main";

/* eslint-disable @typescript-eslint/no-deprecated --
 * Obsidian 1.13.0 added a declarative getSettingDefinitions() API that deprecates display()
 * and setWarning(), but adopting it would raise minAppVersion from 1.8.7 to 1.13.0 and no
 * reference plugin (obsidian-git, obsidian-readwise) has migrated yet - not worth narrowing
 * compatibility for this two-state, dynamically-rerendering settings tab today. Revisit once
 * the declarative API is more established. */
export class IcloudSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: IcloudPlugin,
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		if (this.plugin.settings.connected) {
			this.renderConnected(containerEl);
		} else {
			this.renderNotConnected(containerEl);
		}

		this.renderAdvanced(containerEl);
	}

	private renderNotConnected(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Vault folder")
			.setDesc(
				"Vault-relative folder to clone into. Choose an empty or new folder - `clone` creates it if missing but refuses one it's already bound to.",
			)
			.addText((text) =>
				text
					.setPlaceholder("iCloud notes")
					.setValue(this.plugin.settings.folder)
					.onChange(async (value) => {
						this.plugin.settings.folder = value;
						await this.plugin.saveSettings();
					}),
			);

		let connectButton: ButtonComponent;
		new Setting(containerEl)
			.setName("Connect")
			.setDesc("Runs `icloud-md clone` into the folder above - this opens the iCloud sign-in browser window.")
			.addButton((button) => {
				connectButton = button;
				button
					.setButtonText("Connect")
					.setCta()
					.onClick(async () => {
						if (!this.plugin.settings.folder.trim()) {
							new Notice("Choose a vault folder first.");
							return;
						}
						connectButton.setDisabled(true).setButtonText("Connecting...");
						const success = await this.plugin.connect();
						if (success) {
							this.display();
						} else {
							connectButton.setDisabled(false).setButtonText("Connect");
						}
					});
			});
	}

	private renderConnected(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Vault folder")
			.setDesc("Connected. Disconnect to change it.")
			.addText((text) => text.setValue(this.plugin.settings.folder).setDisabled(true));

		new Setting(containerEl)
			.setName("Sync now")
			.addButton((button) => button.setButtonText("Pull").onClick(() => void this.plugin.pull()))
			.addButton((button) => button.setButtonText("Push").onClick(() => void this.plugin.push()));

		new Setting(containerEl)
			.setName("Reauthenticate")
			.setDesc("Force a fresh iCloud sign-in for this folder.")
			.addButton((button) => button.setButtonText("Reauthenticate").onClick(() => void this.plugin.reauthenticate()));

		new Setting(containerEl)
			.setName("Disconnect")
			.setDesc("Forgets this binding and stops auto-sync. Leaves the cloned files and icloud-side auth untouched.")
			.addButton((button) =>
				button
					.setWarning()
					.setButtonText("Disconnect")
					.onClick(() => {
						this.plugin.disconnect();
						this.display();
					}),
			);

		new Setting(containerEl)
			.setName("Sync automatically")
			.setDesc("Off by default. When enabled, pulls then pushes on the interval below.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoSyncEnabled).onChange(async (value) => {
					this.plugin.settings.autoSyncEnabled = value;
					await this.plugin.saveSettings();
					this.plugin.periodicSync.reload();
					this.display();
				}),
			);

		if (this.plugin.settings.autoSyncEnabled) {
			new Setting(containerEl)
				.setName("Auto-sync interval")
				.setDesc("Minutes between automatic pull-then-push runs.")
				.addText((text) => {
					text.inputEl.type = "number";
					text.inputEl.min = "1";
					text
						.setValue(String(this.plugin.settings.autoSyncIntervalMinutes))
						.onChange(async (value) => {
							const minutes = Number(value);
							if (!Number.isFinite(minutes) || minutes <= 0) {
								return;
							}
							this.plugin.settings.autoSyncIntervalMinutes = minutes;
							await this.plugin.saveSettings();
							this.plugin.periodicSync.reload();
						});
				});
		}
	}

	private renderAdvanced(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Advanced").setHeading();

		new Setting(containerEl)
			.setName("icloud-md binary location")
			.setDesc(
				"Leave blank to use `icloud-md` on PATH. Set this if Obsidian can't find a globally-installed binary.",
			)
			.addText((text) =>
				text
					.setPlaceholder("icloud-md")
					.setValue(this.plugin.localStorage.getBinaryPath() ?? "")
					.onChange((value) => this.plugin.localStorage.setBinaryPath(value)),
			);

		new Setting(containerEl)
			.setName("Extra PATH entries")
			.setDesc(
				"Colon-separated directories to prepend to PATH when spawning icloud-md, such as wherever your Node version manager installs global binaries. GUI-launched Obsidian doesn't inherit your shell's PATH.",
			)
			.addText((text) =>
				text
					.setPlaceholder("/usr/local/bin:/opt/homebrew/bin")
					.setValue(this.plugin.localStorage.getPathAdditions().join(":"))
					.onChange((value) =>
						this.plugin.localStorage.setPathAdditions(value.split(":").filter((entry) => entry.length > 0)),
					),
			);
	}
}
