import assert from "node:assert/strict";
import { test } from "node:test";
import { SyncQueue } from "./syncQueue";

void test("runs tasks serially in the order they were queued", async () => {
	const queue = new SyncQueue();
	const order: number[] = [];

	const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

	const first = queue.run(async () => {
		await delay(20);
		order.push(1);
		return 1;
	});
	const second = queue.run(async () => {
		order.push(2);
		return 2;
	});

	assert.deepEqual(await Promise.all([first, second]), [1, 2]);
	assert.deepEqual(order, [1, 2]);
});

void test("a rejected task does not block later tasks, and resolves its own caller with the rejection", async () => {
	const queue = new SyncQueue();

	const failing = queue.run(async () => {
		throw new Error("boom");
	});
	const after = queue.run(async () => "still runs");

	await assert.rejects(failing, /boom/);
	assert.equal(await after, "still runs");
});
