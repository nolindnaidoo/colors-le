import type { Configuration } from '../types';

/**
 * Performance monitoring and optimization utilities for Colors-LE
 * Provides performance metrics, monitoring, and optimization strategies
 */

export interface PerformanceMetrics {
	readonly operation: string;
	readonly startTime: number;
	readonly endTime: number;
	readonly duration: number;
	readonly inputSize: number;
	readonly outputSize: number;
	readonly colorCount: number;
	readonly memoryUsage: number;
	readonly cpuUsage: number;
	readonly cacheHits: number;
	readonly cacheMisses: number;
	readonly warnings: number;
	readonly errors: number;
}

export interface PerformanceReport {
	readonly metrics: PerformanceMetrics;
	readonly averageDuration: number;
	readonly throughput: number;
	readonly memoryEfficiency: number;
	readonly cacheEfficiency: number;
	readonly recommendations: readonly string[];
}

export interface PerformanceThresholds {
	readonly maxDuration: number;
	readonly maxMemoryUsage: number;
	readonly maxCpuUsage: number;
	readonly minThroughput: number;
	readonly maxCacheSize: number;
}

export interface PerformanceTracker {
	start(operation: string, inputSize: number): void;
	end(
		outputSize: number,
		colorCount: number,
		warnings: number,
		errors: number,
	): PerformanceMetrics | null;
	getMetrics(): PerformanceMetrics[];
	clear(): void;
}

/**
 * Performance monitor class
 */
export class PerformanceMonitor {
	private readonly metrics: PerformanceMetrics[] = [];
	private readonly cache = new Map<
		string,
		{ data: unknown; timestamp: number; hits: number }
	>();
	private readonly thresholds: PerformanceThresholds;
	private currentOperation: {
		operation: string;
		startTime: number;
		inputSize: number;
	} | null = null;

	constructor(thresholds: PerformanceThresholds) {
		this.thresholds = thresholds;
	}

	/**
	 * Start performance monitoring for an operation
	 */
	start(operation: string, inputSize: number): void {
		this.currentOperation = {
			operation,
			startTime: performance.now(),
			inputSize,
		};
	}

	/**
	 * End performance monitoring and record metrics
	 */
	end(
		outputSize: number,
		colorCount: number,
		warnings: number,
		errors: number,
	): PerformanceMetrics | null {
		if (!this.currentOperation) {
			return null;
		}

		const endTime = performance.now();
		const duration = endTime - this.currentOperation.startTime;
		const memoryUsage = this.getMemoryUsage();
		const cpuUsage = this.getCpuUsage();

		const metrics: PerformanceMetrics = {
			operation: this.currentOperation.operation,
			startTime: this.currentOperation.startTime,
			endTime,
			duration,
			inputSize: this.currentOperation.inputSize,
			outputSize,
			colorCount,
			memoryUsage,
			cpuUsage,
			cacheHits: 0, // Will be updated by cache operations
			cacheMisses: 0, // Will be updated by cache operations
			warnings,
			errors,
		};

		this.recordMetrics(metrics);
		this.currentOperation = null;

		return metrics;
	}

	/**
	 * Record completed operation metrics
	 */
	recordMetrics(metrics: PerformanceMetrics): void {
		this.metrics.push(metrics);

		// Keep only last 50 metrics to prevent memory leaks (reduced from 100)
		if (this.metrics.length > 50) {
			const removed = this.metrics.shift();
			// Explicitly nullify reference to help GC
			if (removed) {
				Object.freeze(removed); // Ensure immutability
			}
		}

		// Clean up expired cache entries and limit cache size
		this.cleanupCache();

		// Log slow operations
		if (metrics.duration > this.thresholds.maxDuration) {
			console.warn(
				`Slow operation detected: ${metrics.operation} took ${metrics.duration.toFixed(2)}ms (threshold: ${this.thresholds.maxDuration}ms)`,
			);
		}

		// Log high memory usage
		if (metrics.memoryUsage > this.thresholds.maxMemoryUsage) {
			console.warn(
				`High memory usage detected: ${(metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB (threshold: ${(this.thresholds.maxMemoryUsage / 1024 / 1024).toFixed(1)}MB)`,
			);
		}
	}

	/**
	 * Get performance report
	 */
	getReport(): PerformanceReport {
		const recentMetrics = this.metrics.slice(-10); // Last 10 operations

		if (recentMetrics.length === 0) {
			return this.getEmptyReport();
		}

		const totalDuration = recentMetrics.reduce((sum, m) => sum + m.duration, 0);
		const averageDuration = totalDuration / recentMetrics.length;

		const totalColors = recentMetrics.reduce((sum, m) => sum + m.colorCount, 0);
		const totalTime = recentMetrics.reduce((sum, m) => sum + m.duration, 0);
		const throughput = totalTime > 0 ? (totalColors / totalTime) * 1000 : 0; // colors per second

		const totalMemory = recentMetrics.reduce(
			(sum, m) => sum + m.memoryUsage,
			0,
		);
		const memoryEfficiency =
			totalMemory > 0 ? (totalColors / totalMemory) * 1024 * 1024 : 0; // colors per MB

		const totalCacheHits = recentMetrics.reduce(
			(sum, m) => sum + m.cacheHits,
			0,
		);
		const totalCacheMisses = recentMetrics.reduce(
			(sum, m) => sum + m.cacheMisses,
			0,
		);
		const totalCacheOps = totalCacheHits + totalCacheMisses;
		const cacheEfficiency =
			totalCacheOps > 0 ? (totalCacheHits / totalCacheOps) * 100 : 0;

		const recommendations = this.generateRecommendations(
			recentMetrics,
			averageDuration,
			throughput,
			memoryEfficiency,
		);

		return Object.freeze({
			metrics: recentMetrics[0]!, // Most recent metrics
			averageDuration,
			throughput,
			memoryEfficiency,
			cacheEfficiency,
			recommendations: Object.freeze(recommendations),
		});
	}

	/**
	 * Get cached value or compute and cache
	 */
	getCached<T>(
		key: string,
		compute: () => T,
		maxAge: number = 5 * 60 * 1000,
	): T {
		const now = Date.now();
		const cached = this.cache.get(key);

		if (cached && now - cached.timestamp < maxAge) {
			cached.hits++;
			return cached.data as T;
		}

		const data = compute();
		this.cache.set(key, { data, timestamp: now, hits: 0 });
		return data;
	}

	/**
	 * Get all metrics
	 */
	getMetrics(): PerformanceMetrics[] {
		return [...this.metrics];
	}

	/**
	 * Clear all metrics
	 */
	clear(): void {
		this.metrics.length = 0;
		this.cache.clear();
	}

	/**
	 * Get memory usage in bytes
	 */
	private getMemoryUsage(): number {
		if (process?.memoryUsage) {
			return process.memoryUsage().heapUsed;
		}
		return 0;
	}

	/**
	 * Get CPU usage in microseconds
	 */
	private getCpuUsage(): number {
		if (process?.cpuUsage) {
			const usage = process.cpuUsage();
			return usage.user + usage.system;
		}
		return 0;
	}

	/**
	 * Clean up expired cache entries
	 */
	private cleanupCache(): void {
		const now = Date.now();
		const maxAge = 5 * 60 * 1000; // 5 minutes
		const entries = Array.from(this.cache.entries());

		// Remove expired entries
		for (const [key, value] of entries) {
			if (now - value.timestamp > maxAge) {
				this.cache.delete(key);
				// Explicitly clear references to help GC
				if (value.data && typeof value.data === 'object') {
					Object.freeze(value.data);
				}
			}
		}

		// Also limit cache size to prevent memory leaks
		if (this.cache.size > this.thresholds.maxCacheSize) {
			const remainingEntries = Array.from(this.cache.entries());
			// Sort by timestamp to remove oldest first
			remainingEntries.sort((a, b) => a[1].timestamp - b[1].timestamp);

			// Remove oldest entries (reduced batch size)
			const toRemove = Math.min(50, remainingEntries.length);
			for (let i = 0; i < toRemove; i++) {
				const [key, value] = remainingEntries[i]!;
				this.cache.delete(key);
				// Clear references
				if (value.data && typeof value.data === 'object') {
					Object.freeze(value.data);
				}
			}
		}
	}

	/**
	 * Generate performance recommendations
	 */
	private generateRecommendations(
		metrics: PerformanceMetrics[],
		averageDuration: number,
		throughput: number,
		memoryEfficiency: number,
	): string[] {
		const recommendations: string[] = [];

		if (averageDuration > this.thresholds.maxDuration) {
			recommendations.push(
				'Consider optimizing color extraction algorithms or reducing file size',
			);
		}

		if (throughput < this.thresholds.minThroughput) {
			recommendations.push(
				'Throughput is below optimal. Consider caching or parallel processing',
			);
		}

		if (memoryEfficiency < 1000) {
			recommendations.push(
				'Memory efficiency is low. Consider streaming or chunked processing',
			);
		}

		const errorRate =
			metrics.reduce((sum, m) => sum + m.errors, 0) / metrics.length;
		if (errorRate > 0.1) {
			recommendations.push(
				'High error rate detected. Review error handling and input validation',
			);
		}

		return recommendations;
	}

	/**
	 * Get empty report for when no metrics are available
	 */
	private getEmptyReport(): PerformanceReport {
		return Object.freeze({
			metrics: this.getDefaultMetrics(),
			averageDuration: 0,
			throughput: 0,
			memoryEfficiency: 0,
			cacheEfficiency: 0,
			recommendations: Object.freeze([]),
		});
	}

	/**
	 * Get default metrics
	 */
	private getDefaultMetrics(): PerformanceMetrics {
		return Object.freeze({
			operation: 'unknown',
			startTime: 0,
			endTime: 0,
			duration: 0,
			inputSize: 0,
			outputSize: 0,
			colorCount: 0,
			memoryUsage: 0,
			cpuUsage: 0,
			cacheHits: 0,
			cacheMisses: 0,
			warnings: 0,
			errors: 0,
		});
	}
}

/**
 * Create performance monitor instance
 */
export function createPerformanceMonitor(
	config?: Configuration,
): PerformanceMonitor {
	const thresholds: PerformanceThresholds = {
		maxDuration: config?.performanceMaxDuration ?? 5000, // 5 seconds
		maxMemoryUsage: config?.performanceMaxMemoryUsage ?? 100 * 1024 * 1024, // 100MB
		maxCpuUsage: config?.performanceMaxCpuUsage ?? 1000 * 1000, // 1 second CPU time
		minThroughput: config?.performanceMinThroughput ?? 1000, // 1000 colors per second
		maxCacheSize: config?.performanceMaxCacheSize ?? 1000, // 1000 cache entries
	};

	return new PerformanceMonitor(thresholds);
}

/**
 * Create performance tracker for individual operations
 */
export function createPerformanceTracker(
	config: Configuration,
): PerformanceTracker {
	const monitor = createPerformanceMonitor(config);
	let currentOperation: {
		operation: string;
		startTime: number;
		inputSize: number;
	} | null = null;

	return {
		start(operation: string, inputSize: number): void {
			currentOperation = {
				operation,
				startTime: performance.now(),
				inputSize,
			};
		},

		end(
			outputSize: number,
			colorCount: number,
			warnings: number,
			errors: number,
		): PerformanceMetrics | null {
			if (!currentOperation) {
				return null;
			}

			// Start the monitor operation
			monitor.start(currentOperation.operation, currentOperation.inputSize);

			const metrics = monitor.end(outputSize, colorCount, warnings, errors);
			currentOperation = null;

			return metrics;
		},

		getMetrics(): PerformanceMetrics[] {
			return monitor.getMetrics();
		},

		clear(): void {
			monitor.clear();
		},
	};
}

/**
 * Check if operation should be cancelled based on performance metrics
 */
export function shouldCancelBasedOnPerformance(
	startTime: number,
	processedItems: number,
	maxDuration: number = 30000,
	maxItems: number = 10000,
): boolean {
	const elapsedTime = Date.now() - startTime;
	return elapsedTime > maxDuration || processedItems > maxItems;
}

/**
 * Performance monitoring service with enhanced features
 */
export interface PerformanceMonitoringService {
	startOperation(operation: string): PerformanceOperation;
	getMetrics(): PerformanceMetrics;
	getThresholds(): PerformanceThresholds;
	checkThresholds(
		metrics: PerformanceMetrics,
		thresholds: PerformanceThresholds,
	): PerformanceCheckResult;
	dispose(): void;
}

/**
 * Performance operation tracker
 */
export interface PerformanceOperation {
	end(): PerformanceMetrics;
	cancel(): void;
	isActive(): boolean;
}

/**
 * Performance check result
 */
export interface PerformanceCheckResult {
	readonly passed: boolean;
	readonly warnings: readonly PerformanceWarning[];
	readonly errors: readonly PerformanceError[];
}

/**
 * Performance warning
 */
export interface PerformanceWarning {
	readonly metric: string;
	readonly value: number;
	readonly threshold: number;
	readonly severity: 'warning' | 'error';
	readonly message: string;
}

/**
 * Performance error
 */
export interface PerformanceError {
	readonly category: string;
	readonly severity: 'error';
	readonly message: string;
	readonly recoverable: boolean;
	readonly timestamp: number;
	readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Format bytes for display
 */
export function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 Bytes';

	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format duration for display
 */
export function formatDuration(milliseconds: number): string {
	if (milliseconds < 1000) {
		return `${milliseconds}ms`;
	}

	const seconds = Math.floor(milliseconds / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);

	if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
	if (minutes > 0) return `${minutes}m ${seconds % 60}s`;

	return `${seconds}s`;
}

/**
 * Format throughput for display
 */
export function formatThroughput(throughput: number): string {
	if (throughput < 1) return `${(throughput * 1000).toFixed(0)} colors/min`;
	if (throughput < 60) return `${throughput.toFixed(2)} colors/sec`;

	return `${(throughput * 60).toFixed(0)} colors/min`;
}
