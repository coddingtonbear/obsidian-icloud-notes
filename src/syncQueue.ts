/** Serializes async tasks (manual actions and periodic sync alike) so a pull/push/clone
 * never runs concurrently with another - icloud-md operates on the same on-disk clone
 * state, and overlapping calls would race on it. */
export class SyncQueue {
	private tail: Promise<void> = Promise.resolve();

	run<T>(task: () => Promise<T>): Promise<T> {
		const result = this.tail.then(task);
		this.tail = result.then(
			(): void => undefined,
			(): void => undefined,
		);
		return result;
	}
}
