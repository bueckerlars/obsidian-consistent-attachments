import type { OperationLogEntry } from "./types";

export class OperationLogger {
	private readonly entries: OperationLogEntry[] = [];

	constructor(private readonly limit: () => number) {}

	add(entry: OperationLogEntry): void {
		this.entries.unshift(entry);
		const max = Math.max(1, this.limit());
		if (this.entries.length > max) {
			this.entries.length = max;
		}
	}

	list(): OperationLogEntry[] {
		return [...this.entries];
	}

	clear(): void {
		this.entries.length = 0;
	}
}
