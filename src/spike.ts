import { Notice, normalizePath } from "obsidian";
import * as path from "node:path";
import type IcloudPlugin from "./main";
import { runIcloudMd } from "./cliRunner";

/**
 * WS-3's auth de-risk spike: prove `icloud-md clone` can be spawned from
 * inside Obsidian's Electron process, that Playwright's headed login browser
 * actually opens, and that the resulting session is usable by a follow-up
 * `status` call - before any real UI gets built on top.
 */
export async function runIcloudMdSpike(plugin: IcloudPlugin): Promise<void> {
	const targetDir = path.join(plugin.getVaultBasePath(), normalizePath(plugin.settings.spikeTestFolder));

	new Notice(`obsidian-icloud spike: cloning into ${targetDir}. Watch the console and for a browser login window.`);

	const cloneResult = await runIcloudMd(plugin, ["clone", targetDir], {
		onOutput: (chunk) => console.debug("[obsidian-icloud spike:clone]", chunk.trimEnd()),
	});

	if (cloneResult.error || cloneResult.code !== 0) {
		new Notice(`obsidian-icloud spike: clone failed (see console). ${cloneResult.error?.message ?? `exit code ${cloneResult.code}`}`);
		console.error("[obsidian-icloud spike] clone failed", cloneResult);
		return;
	}

	new Notice("obsidian-icloud spike: clone succeeded, verifying the session with `status`...");

	const statusResult = await runIcloudMd(plugin, ["status", targetDir], {
		onOutput: (chunk) => console.debug("[obsidian-icloud spike:status]", chunk.trimEnd()),
	});

	if (statusResult.error || statusResult.code !== 0) {
		new Notice(`obsidian-icloud spike: status failed after clone (see console). ${statusResult.error?.message ?? `exit code ${statusResult.code}`}`);
		console.error("[obsidian-icloud spike] status failed", statusResult);
		return;
	}

	new Notice("Spike complete: clone and status both succeeded, session is usable.");
}
