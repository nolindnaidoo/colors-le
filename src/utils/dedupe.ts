export function dedupeColors(lines: string[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed && !seen.has(trimmed)) {
			seen.add(trimmed);
			result.push(line);
		}
	}

	return result;
}
