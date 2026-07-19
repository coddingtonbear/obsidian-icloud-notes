import assert from "node:assert/strict";
import { test } from "node:test";
import { parseErrorPayload, parseProgressLine } from "./icloudMdProtocol";

void test("parseProgressLine parses each greppable progress event", () => {
	assert.deepEqual(parseProgressLine("icloud-md:progress:fetch:42"), { type: "fetch", recordsSoFar: 42 });
	assert.deepEqual(parseProgressLine("icloud-md:progress:process-start:100"), {
		type: "process-start",
		total: 100,
	});
	assert.deepEqual(parseProgressLine("icloud-md:progress:process:3/100"), {
		type: "process",
		processed: 3,
		total: 100,
	});
	assert.deepEqual(parseProgressLine("icloud-md:progress:process-done"), { type: "process-done" });
});

void test("parseProgressLine ignores plain status lines", () => {
	assert.equal(parseProgressLine("Opening a browser window for iCloud sign-in..."), undefined);
});

void test("parseErrorPayload extracts the trailing JSON error blob amid interleaved progress/status lines", () => {
	const stderr = [
		"icloud-md:progress:fetch:10",
		"Signing in...",
		"icloud-md:progress:process-start:10",
		"{",
		'  "error": "AuthenticationExpiredError",',
		'  "message": "Your iCloud session has expired.",',
		'  "exitCode": 1',
		"}",
		"",
	].join("\n");

	assert.deepEqual(parseErrorPayload(stderr), {
		error: "AuthenticationExpiredError",
		message: "Your iCloud session has expired.",
		exitCode: 1,
	});
});

void test("parseErrorPayload returns undefined for stderr with no structured payload", () => {
	assert.equal(parseErrorPayload("spawn icloud-md ENOENT\n"), undefined);
});
