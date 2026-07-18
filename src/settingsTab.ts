import { PluginSettingTab, Setting, type App } from "obsidian";
import type IcloudPlugin from "./main";

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

		new Setting(containerEl)
			.setName("Spike test folder")
			.setDesc("Vault-relative folder the auth de-risk spike clones into.")
			.addText((text) =>
				text
					// A literal default folder name, not prose - forcing sentence case here
					// would misrepresent the actual (lowercase) default value.
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setPlaceholder("icloud-spike-test")
					.setValue(this.plugin.settings.spikeTestFolder)
					.onChange(async (value) => {
						this.plugin.settings.spikeTestFolder = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
