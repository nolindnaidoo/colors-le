import { bench } from 'vitest';
import { extractColors } from '../extraction/extract';

// Test data generators
function generateCssContent(size: number): string {
	const colors = [
		'#ff0000',
		'rgb(0, 255, 0)',
		'rgba(0, 0, 255, 0.5)',
		'hsl(120, 100%, 50%)',
	];
	const rules = [];

	for (let i = 0; i < size; i++) {
		const color = colors[i % colors.length];
		rules.push(`.rule-${i} { color: ${color}; background: ${color}; }`);
	}

	return rules.join('\n');
}

function generateJavaScriptContent(size: number): string {
	const colors = [
		'#ff0000',
		'rgb(0, 255, 0)',
		'rgba(0, 0, 255, 0.5)',
		'hsl(120, 100%, 50%)',
	];
	const rules = [];

	for (let i = 0; i < size; i++) {
		const color = colors[i % colors.length];
		rules.push(
			`const style${i} = { color: '${color}', backgroundColor: '${color}' };`,
		);
	}

	return rules.join('\n');
}

function generateHtmlContent(size: number): string {
	const colors = [
		'#ff0000',
		'rgb(0, 255, 0)',
		'rgba(0, 0, 255, 0.5)',
		'hsl(120, 100%, 50%)',
	];
	const elements = [];

	for (let i = 0; i < size; i++) {
		const color = colors[i % colors.length];
		elements.push(
			`<div style="color: ${color}; background: ${color};">Content ${i}</div>`,
		);
	}

	return elements.join('\n');
}

// Benchmark tests
bench('extractColors: CSS - 1KB', async () => {
	const content = generateCssContent(50);
	await extractColors(content, 'css', { enablePerformanceMonitoring: true });
});

bench('extractColors: CSS - 10KB', async () => {
	const content = generateCssContent(500);
	await extractColors(content, 'css', { enablePerformanceMonitoring: true });
});

bench('extractColors: CSS - 100KB', async () => {
	const content = generateCssContent(5000);
	await extractColors(content, 'css', { enablePerformanceMonitoring: true });
});

bench('extractColors: CSS - 1MB', async () => {
	const content = generateCssContent(50000);
	await extractColors(content, 'css', { enablePerformanceMonitoring: true });
});

bench('extractColors: JavaScript - 1KB', async () => {
	const content = generateJavaScriptContent(50);
	await extractColors(content, 'javascript', {
		enablePerformanceMonitoring: true,
	});
});

bench('extractColors: JavaScript - 10KB', async () => {
	const content = generateJavaScriptContent(500);
	await extractColors(content, 'javascript', {
		enablePerformanceMonitoring: true,
	});
});

bench('extractColors: JavaScript - 100KB', async () => {
	const content = generateJavaScriptContent(5000);
	await extractColors(content, 'javascript', {
		enablePerformanceMonitoring: true,
	});
});

bench('extractColors: JavaScript - 1MB', async () => {
	const content = generateJavaScriptContent(50000);
	await extractColors(content, 'javascript', {
		enablePerformanceMonitoring: true,
	});
});

bench('extractColors: HTML - 1KB', async () => {
	const content = generateHtmlContent(50);
	await extractColors(content, 'html', { enablePerformanceMonitoring: true });
});

bench('extractColors: HTML - 10KB', async () => {
	const content = generateHtmlContent(500);
	await extractColors(content, 'html', { enablePerformanceMonitoring: true });
});

bench('extractColors: HTML - 100KB', async () => {
	const content = generateHtmlContent(5000);
	await extractColors(content, 'html', { enablePerformanceMonitoring: true });
});

bench('extractColors: HTML - 1MB', async () => {
	const content = generateHtmlContent(50000);
	await extractColors(content, 'html', { enablePerformanceMonitoring: true });
});

// Memory usage tests
bench('extractColors: Memory usage - Large CSS', async () => {
	const content = generateCssContent(10000);
	await extractColors(content, 'css', { enablePerformanceMonitoring: true });

	// Log memory usage if available
	if (process?.memoryUsage) {
		console.log('Memory usage:', process.memoryUsage());
	}
});

bench('extractColors: Memory usage - Large JavaScript', async () => {
	const content = generateJavaScriptContent(10000);
	await extractColors(content, 'javascript', {
		enablePerformanceMonitoring: true,
	});

	// Log memory usage if available
	if (process?.memoryUsage) {
		console.log('Memory usage:', process.memoryUsage());
	}
});

bench('extractColors: Memory usage - Large HTML', async () => {
	const content = generateHtmlContent(10000);
	await extractColors(content, 'html', { enablePerformanceMonitoring: true });

	// Log memory usage if available
	if (process?.memoryUsage) {
		console.log('Memory usage:', process.memoryUsage());
	}
});
