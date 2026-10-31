export function formatDuration(milliseconds: number): string {
	// `performance.now()` hands over a fraction of a millisecond; the reports
	// printed it as "2.8999999999999986ms".
	const whole = Math.round(milliseconds);
	if (whole < 1000) {
		return `${whole}ms`;
	}

	const seconds = Math.floor(whole / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);

	if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
	if (minutes > 0) return `${minutes}m ${seconds % 60}s`;

	return `${seconds}s`;
}
