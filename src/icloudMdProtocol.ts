/** Pure parsing for icloud-md's `--json` stdout/stderr contract - kept free of any Obsidian
 * import so it can be unit-tested directly under plain Node. */

const PROGRESS_PREFIX = "icloud-md:progress:";

export type IcloudMdProgress =
	| { type: "fetch"; recordsSoFar: number }
	| { type: "process-start"; total: number }
	| { type: "process"; processed: number; total: number }
	| { type: "process-done" };

export interface IcloudMdErrorPayload {
	error: string;
	message: string;
	hint?: string;
	exitCode: number;
}

export function parseProgressLine(line: string): IcloudMdProgress | undefined {
	if (!line.startsWith(PROGRESS_PREFIX)) {
		return undefined;
	}
	const body = line.slice(PROGRESS_PREFIX.length);
	const [kind, rest] = body.split(":", 2);
	switch (kind) {
		case "fetch":
			return { type: "fetch", recordsSoFar: Number(rest) };
		case "process-start":
			return { type: "process-start", total: Number(rest) };
		case "process": {
			const [processed, total] = rest.split("/");
			return { type: "process", processed: Number(processed), total: Number(total) };
		}
		case "process-done":
			return { type: "process-done" };
		default:
			return undefined;
	}
}

/** The final catch in icloud-md's `main()` writes one pretty-printed JSON payload as the last thing on stderr; find it amid any progress/status lines that preceded it. */
export function parseErrorPayload(stderr: string): IcloudMdErrorPayload | undefined {
	const start = stderr.lastIndexOf("\n{");
	const jsonText = start === -1 ? (stderr.trimStart().startsWith("{") ? stderr : undefined) : stderr.slice(start + 1);
	if (!jsonText) {
		return undefined;
	}
	try {
		const parsed: unknown = JSON.parse(jsonText);
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			"error" in parsed &&
			"message" in parsed &&
			"exitCode" in parsed
		) {
			return parsed as IcloudMdErrorPayload;
		}
	} catch {
		// stderr wasn't a structured error payload (e.g. spawn() failure) - fall through.
	}
	return undefined;
}
