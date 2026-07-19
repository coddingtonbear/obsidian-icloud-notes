import type IcloudPlugin from "./main";

/**
 * Off by default (per WS-4: periodic sync must be opt-in, not automatic). When enabled,
 * runs pull-then-push every `autoSyncIntervalMinutes` minutes via `registerInterval`, so
 * Obsidian clears the timer on unload/reload for us. Every run goes through the plugin's
 * `SyncQueue`, so it never overlaps a manual pull/push/clone/reauthenticate.
 */
export class PeriodicSync {
	private intervalId: number | undefined;

	constructor(private readonly plugin: IcloudPlugin) {}

	reload(): void {
		this.stop();
		if (!this.plugin.settings.autoSyncEnabled || !this.plugin.settings.connected) {
			return;
		}
		const intervalMs = Math.max(1, this.plugin.settings.autoSyncIntervalMinutes) * 60 * 1000;
		this.intervalId = this.plugin.registerInterval(
			window.setInterval((): void => void this.plugin.runAutoSync(), intervalMs),
		);
	}

	stop(): void {
		if (this.intervalId !== undefined) {
			window.clearInterval(this.intervalId);
			this.intervalId = undefined;
		}
	}
}
