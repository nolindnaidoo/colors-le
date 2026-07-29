import { describe, expect, it } from 'vitest';
import {
	createPerformanceMonitor,
	createPerformanceTracker,
	shouldCancelBasedOnPerformance,
} from './performance';

describe('Performance Monitoring', () => {
	describe('createPerformanceMonitor', () => {
		it('should create performance monitor with thresholds', () => {
			const monitor = createPerformanceMonitor();

			expect(monitor).toBeDefined();
			expect(typeof monitor.start).toBe('function');
			expect(typeof monitor.end).toBe('function');
			expect(typeof monitor.getMetrics).toBe('function');
			expect(typeof monitor.clear).toBe('function');
		});

		it('should track operation performance', () => {
			const monitor = createPerformanceMonitor();

			monitor.start('test-operation', 1000);
			const metrics = monitor.end(500, 10, 2, 0);

			expect(metrics).toBeDefined();
			expect(metrics?.operation).toBe('test-operation');
			expect(metrics?.inputSize).toBe(1000);
			expect(metrics?.outputSize).toBe(500);
			expect(metrics?.colorCount).toBe(10);
			expect(metrics?.warnings).toBe(2);
			expect(metrics?.errors).toBe(0);
			expect(metrics?.duration).toBeGreaterThanOrEqual(0);
		});

		it('should record metrics', () => {
			const monitor = createPerformanceMonitor();

			monitor.start('test-operation', 1000);
			const metrics = monitor.end(500, 10, 2, 0);

			const allMetrics = monitor.getMetrics();
			expect(allMetrics).toHaveLength(1);
			expect(allMetrics[0]).toEqual(metrics);
		});

		it('should clear metrics', () => {
			const monitor = createPerformanceMonitor();

			monitor.start('test-operation', 1000);
			monitor.end(500, 10, 2, 0);

			expect(monitor.getMetrics()).toHaveLength(1);

			monitor.clear();
			expect(monitor.getMetrics()).toHaveLength(0);
		});

		it('should limit stored metrics to prevent memory leaks', () => {
			const monitor = createPerformanceMonitor();

			// Add more than 100 metrics
			for (let i = 0; i < 150; i++) {
				monitor.start(`operation-${i}`, 1000);
				monitor.end(500, 10, 0, 0);
			}

			const metrics = monitor.getMetrics();
			expect(metrics?.length).toBeLessThanOrEqual(100);
		});

		it('should generate performance report', () => {
			const monitor = createPerformanceMonitor();

			monitor.start('test-operation', 1000);
			monitor.end(500, 10, 2, 0);

			const report = monitor.getReport();
			expect(report).toBeDefined();
			expect(report.metrics.operation).toBe('test-operation');
			expect(report.averageDuration).toBeGreaterThanOrEqual(0);
			expect(report.throughput).toBeGreaterThanOrEqual(0);
		});

		it('should handle cache operations', () => {
			const monitor = createPerformanceMonitor();

			const result1 = monitor.getCached('test-key', () => 'cached-value');
			const result2 = monitor.getCached('test-key', () => 'new-value');

			expect(result1).toBe('cached-value');
			expect(result2).toBe('cached-value'); // Should be cached
		});
	});

	describe('createPerformanceTracker', () => {
		it('should create performance tracker', () => {
			const tracker = createPerformanceTracker();

			expect(tracker).toBeDefined();
			expect(typeof tracker.start).toBe('function');
			expect(typeof tracker.end).toBe('function');
			expect(typeof tracker.getMetrics).toBe('function');
			expect(typeof tracker.clear).toBe('function');
		});

		it('should track operation with tracker', () => {
			const tracker = createPerformanceTracker();

			tracker.start('test-operation', 1000);
			const metrics = tracker.end(500, 10, 2, 0);

			expect(metrics).toBeDefined();
			expect(metrics?.operation).toBe('test-operation');
			expect(metrics?.inputSize).toBe(1000);
			expect(metrics?.outputSize).toBe(500);
			expect(metrics?.colorCount).toBe(10);
		});

		it('should return null if no operation started', () => {
			const tracker = createPerformanceTracker();

			const metrics = tracker.end(500, 10, 2, 0);
			expect(metrics).toBeNull();
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

	describe('Performance Edge Cases', () => {
		it('should handle rapid start/end cycles', () => {
			const monitor = createPerformanceMonitor();

			for (let i = 0; i < 10; i++) {
				monitor.start(`operation-${i}`, 0);
				monitor.end(0, 0, 0, 0);
			}

			const metrics = monitor.getMetrics();
			expect(metrics?.length).toBeGreaterThan(0);
		});

		it('should handle operations with same name', () => {
			const monitor = createPerformanceMonitor();

			monitor.start('same-op', 0);
			monitor.end(0, 0, 0, 0);
			monitor.start('same-op', 0);
			monitor.end(0, 0, 0, 0);

			const metrics = monitor.getMetrics();
			expect(metrics?.length).toBeGreaterThan(0);
		});

		it('should handle ending non-existent operation', () => {
			const monitor = createPerformanceMonitor();
			monitor.end(0, 0, 0, 0);

			const metrics = monitor.getMetrics();
			expect(metrics?.length).toBe(0);
		});
	});
});
