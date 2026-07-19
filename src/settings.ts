export interface IcloudSettings {
	/** Vault-relative folder cloned into / synced with iCloud Notes. */
	folder: string;
	/** Plugin-local "bound" flag - set once `clone` succeeds, cleared by Disconnect. Leaves the cloned files and iCloud-side auth untouched either way. */
	connected: boolean;
	autoSyncEnabled: boolean;
	autoSyncIntervalMinutes: number;
}

export const DEFAULT_SETTINGS: IcloudSettings = {
	folder: "",
	connected: false,
	autoSyncEnabled: false,
	autoSyncIntervalMinutes: 30,
};
