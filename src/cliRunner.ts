import { spawn } from "node:child_process";
import { Platform } from "obsidian";
import type IcloudPlugin from "./main";

export interface CliRunResult {
	stdout: string;
	stderr: string;
	code: number | null;
	error: Error | undefined;
}

export interface CliRunOptions {
	cwd?: string;
	onOutput?: (chunk: string, stream: "stdout" | "stderr") => void;
}

/** The user's explicit override, falling back to bare `icloud-md` on PATH. */
function resolveBinary(plugin: IcloudPlugin): string {
	return plugin.localStorage.getBinaryPath() || "icloud-md";
}

/**
 * GUI-launched Obsidian doesn't inherit the shell PATH, so npm's global bin
 * dir (nvm/Homebrew/asdf) is often invisible to spawn(). User-editable extra
 * PATH entries are prepended, mirroring obsidian-git's simpleGit.ts pattern.
 */
function buildEnv(plugin: IcloudPlugin): NodeJS.ProcessEnv {
	const env = { ...process.env };
	const additions = plugin.localStorage.getPathAdditions();
	if (additions.length > 0) {
		env["PATH"] = additions.join(":") + ":" + (env["PATH"] ?? "");
	}
	return env;
}

/** Spawns the icloud-md CLI and resolves once it exits, streaming output as it arrives. */
export function runIcloudMd(plugin: IcloudPlugin, args: string[], options: CliRunOptions = {}): Promise<CliRunResult> {
	if (!Platform.isDesktopApp) {
		return Promise.resolve({
			stdout: "",
			stderr: "",
			code: null,
			error: new Error("icloud-md can only be run on desktop"),
		});
	}

	return new Promise((resolve) => {
		const child = spawn(resolveBinary(plugin), args, {
			cwd: options.cwd,
			env: buildEnv(plugin),
		});

		let stdout = "";
		let stderr = "";

		child.stdout.on("data", (data: Buffer) => {
			const chunk = data.toString();
			stdout += chunk;
			options.onOutput?.(chunk, "stdout");
		});
		child.stderr.on("data", (data: Buffer) => {
			const chunk = data.toString();
			stderr += chunk;
			options.onOutput?.(chunk, "stderr");
		});

		child.on("error", (err) => {
			resolve({ stdout, stderr, code: null, error: err });
		});
		child.on("close", (code) => {
			resolve({ stdout, stderr, code, error: undefined });
		});
	});
}
