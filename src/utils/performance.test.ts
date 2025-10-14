import { describe, expect, it } from 'vitest';
import type { Configuration } from '../types';
import {
	createPerformanceMonitor,
	createPerformanceTracker,
	createPerformanceWarning,
	formatPerformanceReport,
	shouldCancelBasedOnPerformance,
} from './performance';

const mockConfig: Configuration = {
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

describe('Performance Monitoring', () => {
	describe('createPerformanceMonitor', () => {
		it('should create performance monitor with thresholds', () => {
			const monitor = createPerformanceMonitor(mockConfig);

			expect(monitor).toBeDefined();
			expect(typeof monitor.start).toBe('function');
			expect(typeof monitor.end).toBe('function');
			expect(typeof monitor.getMetrics).toBe('function');
			expect(typeof monitor.clear).toBe('function');
		});

		it('should track operation performance', () => {
			const monitor = createPerformanceMonitor(mockConfig);

			monitor.start('test-operation', 1000);
			const metrics = monitor.end(500, 10, 2, 0);

			expect(metrics).toBeDefined();
			expect(metrics.operation).toBe('test-operation');
			expect(metrics.inputSize).toBe(1000);
			expect(metrics.outputSize).toBe(500);
			expect(metrics.colorCount).toBe(10);
			expect(metrics.warnings).toBe(2);
			expect(metrics.errors).toBe(0);
			expect(metrics.duration).toBeGreaterThanOrEqual(0);
		});

		it('should record metrics', () => {
			const monitor = createPerformanceMonitor(mockConfig);

			monitor.start('test-operation', 1000);
			const metrics = monitor.end(500, 10, 2, 0);

			const allMetrics = monitor.getMetrics();
			expect(allMetrics).toHaveLength(1);
			expect(allMetrics[0]).toEqual(metrics);
		});

		it('should clear metrics', () => {
			const monitor = createPerformanceMonitor(mockConfig);

			monitor.start('test-operation', 1000);
			monitor.end(500, 10, 2, 0);

			expect(monitor.getMetrics()).toHaveLength(1);

			monitor.clear();
			expect(monitor.getMetrics()).toHaveLength(0);
		});

		it('should limit stored metrics to prevent memory leaks', () => {
			const monitor = createPerformanceMonitor(mockConfig);

			// Add more than 100 metrics
			for (let i = 0; i < 150; i++) {
				monitor.start(`operation-${i}`, 1000);
				monitor.end(500, 10, 0, 0);
			}

			const metrics = monitor.getMetrics();
			expect(metrics.length).toBeLessThanOrEqual(100);
		});

		it('should generate performance report', () => {
			const monitor = createPerformanceMonitor(mockConfig);

			monitor.start('test-operation', 1000);
			monitor.end(500, 10, 2, 0);

			const report = monitor.getReport();
			expect(report).toBeDefined();
			expect(report.metrics.operation).toBe('test-operation');
			expect(report.averageDuration).toBeGreaterThanOrEqual(0);
			expect(report.throughput).toBeGreaterThanOrEqual(0);
		});

		it('should handle cache operations', () => {
			const monitor = createPerformanceMonitor(mockConfig);

			const result1 = monitor.getCached('test-key', () => 'cached-value');
			const result2 = monitor.getCached('test-key', () => 'new-value');

			expect(result1).toBe('cached-value');
			expect(result2).toBe('cached-value'); // Should be cached
		});
	});

	describe('createPerformanceTracker', () => {
		it('should create performance tracker', () => {
			const tracker = createPerformanceTracker(mockConfig);

			expect(tracker).toBeDefined();
			expect(typeof tracker.start).toBe('function');
			expect(typeof tracker.end).toBe('function');
			expect(typeof tracker.getMetrics).toBe('function');
			expect(typeof tracker.clear).toBe('function');
		});

		it('should track operation with tracker', () => {
			const tracker = createPerformanceTracker(mockConfig);

			tracker.start('test-operation', 1000);
			const metrics = tracker.end(500, 10, 2, 0);

			expect(metrics).toBeDefined();
			expect(metrics.operation).toBe('test-operation');
			expect(metrics.inputSize).toBe(1000);
			expect(metrics.outputSize).toBe(500);
			expect(metrics.colorCount).toBe(10);
		});

		it('should return null if no operation started', () => {
			const tracker = createPerformanceTracker(mockConfig);

			const metrics = tracker.end(500, 10, 2, 0);
			expect(metrics).toBeNull();
		});
	});

	describe('formatPerformanceReport', () => {
		it('should format performance report', () => {
			const report = {
				metrics: {
					operation: 'test-operation',
					startTime: 0,
					endTime: 1000,
					duration: 1000,
					inputSize: 1000,
					outputSize: 500,
					colorCount: 10,
					memoryUsage: 1024,
					cpuUsage: 100,
					cacheHits: 5,
					cacheMisses: 2,
					warnings: 1,
					errors: 0,
				},
				averageDuration: 1000,
				throughput: 10,
				memoryEfficiency: 100,
				cacheEfficiency: 71.4,
				recommendations: ['Test recommendation'],
			};

			const formatted = formatPerformanceReport(report);
			expect(formatted).toContain('Performance Report:');
			expect(formatted).toContain('test-operation');
			expect(formatted).toContain('1000.00ms');
			expect(formatted).toContain('10 colors/sec');
		});
	});

	describe('shouldCancelBasedOnPerformance', () => {
		it('should cancel when duration exceeds limit', () => {
			const startTime = Date.now() - 35000; // 35 seconds ago
			const shouldCancel = shouldCancelBasedOnPerformance(
				startTime,
				100,
				30000,
			);

			expect(shouldCancel).toBe(true);
		});

		it('should cancel when processed items exceed limit', () => {
			const startTime = Date.now();
			const shouldCancel = shouldCancelBasedOnPerformance(
				startTime,
				15000,
				30000,
				10000,
			);

			expect(shouldCancel).toBe(true);
		});

		it('should not cancel when within limits', () => {
			const startTime = Date.now();
			const shouldCancel = shouldCancelBasedOnPerformance(
				startTime,
				100,
				30000,
				10000,
			);

			expect(shouldCancel).toBe(false);
		});

		it('should respect custom limits', () => {
			const startTime = Date.now() - 5000; // 5 seconds ago
			const shouldCancel = shouldCancelBasedOnPerformance(
				startTime,
				100,
				3000,
				10000,
			);

			expect(shouldCancel).toBe(true);
		});
	});

	describe('createPerformanceWarning', () => {
		it('should create performance warning', () => {
			const warning = createPerformanceWarning('Test warning', {
				test: 'value',
			});

			expect(warning.message).toBe('Test warning');
			expect(warning.category).toBe('safety');
			expect(warning.severity).toBe('medium');
			expect(warning.recoverable).toBe(true);
		});
	});
});
