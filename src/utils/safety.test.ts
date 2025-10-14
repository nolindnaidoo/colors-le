import { describe, expect, it } from 'vitest';
import type { Configuration } from '../types';
import { shouldCancelOperation } from './safety';

// Standalone safety utility functions for testing
function estimateColorCount(content: string): number {
	// Simple heuristic based on common color patterns
	const hexColors = (content.match(/#[0-9a-fA-F]{3,8}/g) || []).length;
	const rgbColors = (content.match(/rgb\([^)]+\)/g) || []).length;
	const rgbaColors = (content.match(/rgba\([^)]+\)/g) || []).length;
	const hslColors = (content.match(/hsl\([^)]+\)/g) || []).length;
	const hslaColors = (content.match(/hsla\([^)]+\)/g) || []).length;

	return hexColors + rgbColors + rgbaColors + hslColors + hslaColors;
}

function countComplexPatterns(content: string): number {
	// Count complex selectors, nested rules, etc.
	const complexSelectors = (content.match(/[.#][^{]*[>:][^{]*\{/g) || [])
		.length;
	const mediaQueries = (content.match(/@media[^{]*\{/g) || []).length;
	const keyframes = (content.match(/@keyframes[^{]*\{/g) || []).length;
	const functions = (content.match(/var\([^)]+\)/g) || []).length;
	const mixins = (content.match(/@mixin[^{]*\{/g) || []).length;

	return complexSelectors + mediaQueries + keyframes + functions + mixins;
}

const _mockConfig: Configuration = {
	copyToClipboardEnabled: true,
	dedupeEnabled: true,
	notificationsLevel: 'all',
	postProcessOpenInNewFile: false,
	openResultsSideBySide: false,
	safetyEnabled: true,
	safetyFileSizeWarnBytes: 1000,
	safetyLargeOutputLinesThreshold: 100,
	safetyManyDocumentsThreshold: 50,
	showParseErrors: true,
	sortEnabled: true,
	sortMode: 'off',
	statusBarEnabled: true,
	telemetryEnabled: true,
	analysisEnabled: true,
	analysisIncludeAccessibility: true,
	analysisIncludeContrast: true,
	outputFormat: 'hex',
	performanceMonitoringEnabled: true,
	performanceThresholds: {
		maxDuration: 5000,
		maxMemoryUsage: 100 * 1024 * 1024,
		maxCpuUsage: 1000 * 1000,
		minThroughput: 1000,
		maxCacheSize: 1000,
	},
};

describe('Safety Checks', () => {
	describe('shouldCancelOperation', () => {
		it('should cancel when processed items exceed threshold', () => {
			const startTime = Date.now();
			const shouldCancel = shouldCancelOperation(
				15000,
				10000,
				startTime,
				30000,
			);

			expect(shouldCancel).toBe(true);
		});

		it('should cancel when time exceeds limit', () => {
			const startTime = Date.now() - 35000; // 35 seconds ago
			const shouldCancel = shouldCancelOperation(100, 10000, startTime, 30000);

			expect(shouldCancel).toBe(true);
		});

		it('should not cancel when within limits', () => {
			const startTime = Date.now();
			const shouldCancel = shouldCancelOperation(100, 10000, startTime, 30000);

			expect(shouldCancel).toBe(false);
		});

		it('should respect custom time limit', () => {
			const startTime = Date.now() - 5000; // 5 seconds ago
			const shouldCancel = shouldCancelOperation(100, 10000, startTime, 3000);

			expect(shouldCancel).toBe(true);
		});
	});

	describe('estimateColorCount', () => {
		it('should count hex colors', () => {
			const content = `
        .header { color: #ff0000; }
        .footer { background: #00ff00; }
        .sidebar { border: 1px solid #0000ff; }
      `;
			const count = estimateColorCount(content);

			expect(count).toBe(3);
		});

		it('should count rgb colors', () => {
			const content = `
        .header { color: rgb(255, 0, 0); }
        .footer { background: rgb(0, 255, 0); }
        .sidebar { border: 1px solid rgb(0, 0, 255); }
      `;
			const count = estimateColorCount(content);

			expect(count).toBe(3);
		});

		it('should count rgba colors', () => {
			const content = `
        .header { color: rgba(255, 0, 0, 0.5); }
        .footer { background: rgba(0, 255, 0, 0.8); }
      `;
			const count = estimateColorCount(content);

			expect(count).toBe(2);
		});

		it('should count hsl colors', () => {
			const content = `
        .header { color: hsl(0, 100%, 50%); }
        .footer { background: hsl(120, 100%, 50%); }
      `;
			const count = estimateColorCount(content);

			expect(count).toBe(2);
		});

		it('should count hsla colors', () => {
			const content = `
        .header { color: hsla(0, 100%, 50%, 0.5); }
        .footer { background: hsla(120, 100%, 50%, 0.8); }
      `;
			const count = estimateColorCount(content);

			expect(count).toBe(2);
		});

		it('should count mixed color formats', () => {
			const content = `
        .header { color: #ff0000; }
        .footer { background: rgb(0, 255, 0); }
        .sidebar { border: 1px solid hsl(240, 100%, 50%); }
        .content { color: rgba(255, 0, 255, 0.5); }
      `;
			const count = estimateColorCount(content);

			expect(count).toBe(4);
		});
	});

	describe('countComplexPatterns', () => {
		it('should count complex selectors', () => {
			const content = `
        .header > .nav ul li:first-child:hover { color: #ff0000; }
        .footer .links a[href^="http"]:not(.external) { color: #00ff00; }
        .sidebar .widget:nth-child(odd) .title { color: #0000ff; }
      `;
			const count = countComplexPatterns(content);

			expect(count).toBeGreaterThanOrEqual(1);
		});

		it('should count media queries', () => {
			const content = `
        @media (max-width: 768px) { .header { color: #ff0000; } }
        @media (min-width: 1024px) { .footer { color: #00ff00; } }
        @media (prefers-color-scheme: dark) { .sidebar { color: #0000ff; } }
      `;
			const count = countComplexPatterns(content);

			expect(count).toBeGreaterThanOrEqual(3);
		});

		it('should count keyframes', () => {
			const content = `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }
      `;
			const count = countComplexPatterns(content);

			expect(count).toBe(2);
		});

		it('should count functions', () => {
			const content = `
        .header { color: var(--primary-color); }
        .footer { background: calc(100% - 20px); }
        .sidebar { width: min(100%, 300px); }
      `;
			const count = countComplexPatterns(content);

			expect(count).toBeGreaterThanOrEqual(1);
		});

		it('should count mixins', () => {
			const content = `
        @mixin button-style { color: #ff0000; }
        @mixin card-style { background: #00ff00; }
      `;
			const count = countComplexPatterns(content);

			expect(count).toBe(2);
		});

		it('should count mixed patterns', () => {
			const content = `
        .header > .nav:hover { color: #ff0000; }
        @media (max-width: 768px) { .footer { color: #00ff00; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .sidebar { color: var(--primary-color); }
      `;
			const count = countComplexPatterns(content);

			expect(count).toBeGreaterThanOrEqual(3);
		});
	});
});
