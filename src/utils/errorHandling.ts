import * as nls from 'vscode-nls';

const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

/**
 * Enhanced error handling utilities for Colors-LE
 * Provides sophisticated error categorization, recovery, and user feedback
 */

export type ErrorCategory =
	| 'parse'
	| 'validation'
	| 'safety'
	| 'operational'
	| 'file-system'
	| 'configuration';

export interface EnhancedError {
	readonly category: ErrorCategory;
	readonly originalError: Error;
	readonly message: string;
	readonly userFriendlyMessage: string;
	readonly userMessage: string;
	readonly suggestion: string;
	readonly recoverable: boolean;
	readonly severity: 'low' | 'medium' | 'high';
	readonly timestamp: Date;
}

export interface ErrorRecoveryOptions {
	readonly retryable: boolean;
	readonly maxRetries: number;
	readonly retryDelay: number;
	readonly fallbackAction?: () => Promise<void>;
	readonly userAction?: string;
}

/**
 * Create an enhanced error with categorization and user-friendly messaging
 */
export function createEnhancedError(
	error: Error,
	category: ErrorCategory,
	context?: Record<string, unknown>,
	options?: {
		recoverable?: boolean;
		severity?: 'low' | 'medium' | 'high';
		suggestion?: string;
	},
): EnhancedError {
	const userFriendlyMessage = getUserFriendlyMessage(
		error,
		category,
		context?.filepath as string,
	);
	const suggestion = options?.suggestion || getErrorSuggestion(error, category);
	const recoverable =
		options?.recoverable ?? isRecoverableError(error, category);
	const severity = options?.severity || 'medium';

	return Object.freeze({
		category,
		originalError: error,
		message: error.message,
		userFriendlyMessage,
		userMessage: userFriendlyMessage,
		suggestion,
		recoverable,
		severity,
		timestamp: new Date(),
	});
}

/**
 * Determine if an error is recoverable
 */
function isRecoverableError(error: Error, category: ErrorCategory): boolean {
	if (category === 'parse') {
		return true;
	}

	if (category === 'file-system') {
		const hasPermissionIssue = error.message.includes('permission');
		const hasNetworkIssue = error.message.includes('network');
		return hasPermissionIssue || hasNetworkIssue;
	}

	if (category === 'configuration') {
		return true;
	}

	if (category === 'validation') {
		return true;
	}

	if (category === 'safety') {
		return false;
	}

	if (category === 'operational') {
		const isFatalError = error.message.includes('fatal');
		return !isFatalError;
	}

	return false;
}

/**
 * Get user-friendly error message
 */
function getUserFriendlyMessage(
	error: Error,
	category: ErrorCategory,
	context?: string,
): string {
	if (category === 'parse') {
		const fileContext = context || 'unknown file';
		return localize(
			'runtime.error.parse',
			'Failed to parse color values: {0}',
			fileContext,
		);
	}

	if (category === 'file-system') {
		return localize(
			'runtime.error.file-system',
			'File system error: {0}',
			error.message,
		);
	}

	if (category === 'configuration') {
		return localize(
			'runtime.error.configuration',
			'Configuration error: {0}',
			error.message,
		);
	}

	if (category === 'validation') {
		return localize(
			'runtime.error.validation',
			'Color validation failed: {0}',
			error.message,
		);
	}

	if (category === 'safety') {
		return localize(
			'runtime.error.safety',
			'Safety threshold exceeded: {0}',
			error.message,
		);
	}

	if (category === 'operational') {
		return localize(
			'runtime.error.operational',
			'Color extraction failed: {0}',
			error.message,
		);
	}

	return localize('runtime.error.unknown', 'Unknown error: {0}', error.message);
}

/**
 * Get error recovery suggestion
 */
function getErrorSuggestion(_error: Error, category: ErrorCategory): string {
	switch (category) {
		case 'parse':
			return localize(
				'runtime.error.parse.suggestion',
				'Check the file format and ensure color values are valid',
			);
		case 'file-system':
			return localize(
				'runtime.error.file-system.suggestion',
				'Check file permissions and ensure the file exists',
			);
		case 'configuration':
			return localize(
				'runtime.error.configuration.suggestion',
				'Reset to default settings or check configuration syntax',
			);
		case 'validation':
			return localize(
				'runtime.error.validation.suggestion',
				'Review color values and ensure they meet validation criteria',
			);
		case 'safety':
			return localize(
				'runtime.error.safety.suggestion',
				'Reduce file size or adjust safety thresholds',
			);
		case 'operational':
			return localize(
				'runtime.error.operational.suggestion',
				'Try again or check system resources',
			);
		default:
			return localize(
				'runtime.error.unknown.suggestion',
				'Check the logs for more details and consider reporting this issue',
			);
	}
}

/**
 * Get error recovery options
 */
export function getErrorRecoveryOptions(
	error: EnhancedError,
): ErrorRecoveryOptions {
	switch (error.category) {
		case 'file-system':
			return Object.freeze({
				retryable: true,
				maxRetries: 3,
				retryDelay: 1000,
			});
		case 'operational':
			return Object.freeze({
				retryable: true,
				maxRetries: 2,
				retryDelay: 2000,
			});
		case 'configuration':
			return Object.freeze({
				retryable: false,
				maxRetries: 0,
				retryDelay: 0,
				fallbackAction: async () => {
					// Fallback to default configuration
				},
			});
		default:
			return Object.freeze({
				retryable: false,
				maxRetries: 0,
				retryDelay: 0,
			});
	}
}

/**
 * Sanitize error message for display
 */
export function sanitizeErrorMessage(message: string): string {
	// Remove sensitive information
	return message
		.replace(/\/Users\/[^/]+\//g, '/Users/***/')
		.replace(/\/home\/[^/]+\//g, '/home/***/')
		.replace(/C:\\Users\\[^\\]+\\/g, 'C:\\Users\\***\\')
		.replace(/password[=:]\s*[^\s]+/gi, 'password=***')
		.replace(/token[=:]\s*[^\s]+/gi, 'token=***')
		.replace(/key[=:]\s*[^\s]+/gi, 'key=***');
}

/**
 * Handle error with appropriate user feedback
 */
export function handleError(error: EnhancedError): void {
	const sanitizedMessage = sanitizeErrorMessage(error.userFriendlyMessage);
	const timestamp = error.timestamp.toISOString();
	const logLevel = error.recoverable ? 'WARN' : 'ERROR';

	const logEntry = Object.freeze({
		timestamp,
		level: logLevel,
		category: error.category,
		message: sanitizedMessage,
		suggestion: error.suggestion,
		recoverable: error.recoverable,
		severity: error.severity,
		originalError: error.originalError.message,
	});

	const logMessage = `[Colors-LE] ${logLevel}: ${sanitizedMessage}`;

	if (error.recoverable) {
		console.warn(logMessage, logEntry);
		return;
	}

	console.error(logMessage, logEntry);
}

export interface ErrorSummary {
	readonly totalErrors: number;
	readonly recoverableErrors: number;
	readonly nonRecoverableErrors: number;
	readonly categories: Record<ErrorCategory, number>;
	readonly severity: Record<'low' | 'medium' | 'high', number>;
}

export function createErrorSummary(
	errors: readonly EnhancedError[],
): ErrorSummary {
	const categories: Record<ErrorCategory, number> = {
		parse: 0,
		validation: 0,
		safety: 0,
		operational: 0,
		'file-system': 0,
		configuration: 0,
	};

	const severity: Record<'low' | 'medium' | 'high', number> = {
		low: 0,
		medium: 0,
		high: 0,
	};

	let recoverableCount = 0;
	let nonRecoverableCount = 0;

	for (const error of errors) {
		categories[error.category] = (categories[error.category] || 0) + 1;
		severity[error.severity] = (severity[error.severity] || 0) + 1;

		if (error.recoverable) {
			recoverableCount++;
			continue;
		}

		nonRecoverableCount++;
	}

	return Object.freeze({
		totalErrors: errors.length,
		recoverableErrors: recoverableCount,
		nonRecoverableErrors: nonRecoverableCount,
		categories: Object.freeze(categories),
		severity: Object.freeze(severity),
	});
}

export function formatErrorSummary(summary: ErrorSummary): string {
	const lines: string[] = [
		`Total Errors: ${summary.totalErrors}`,
		`Recoverable: ${summary.recoverableErrors}`,
		`Non-recoverable: ${summary.nonRecoverableErrors}`,
		'',
		'By Category:',
	];

	for (const [category, count] of Object.entries(summary.categories)) {
		if (count <= 0) {
			continue;
		}
		lines.push(`  ${category}: ${count}`);
	}

	lines.push('');
	lines.push('By Severity:');

	for (const [sev, count] of Object.entries(summary.severity)) {
		if (count <= 0) {
			continue;
		}
		lines.push(`  ${sev}: ${count}`);
	}

	return lines.join('\n');
}

/**
 * Error Handler interface for dependency injection
 */
export interface ErrorHandler {
	handle(error: EnhancedError): void;
	dispose(): void;
}

/**
 * Error Logger interface for dependency injection
 */
export interface ErrorLogger {
	log(error: EnhancedError): void;
	dispose(): void;
}

/**
 * Error Notifier interface for dependency injection
 */
export interface ErrorNotifier {
	notify(error: EnhancedError): void;
	dispose(): void;
}

/**
 * Create error handler instance
 */
export function createErrorHandler(): ErrorHandler {
	return Object.freeze({
		handle(error: EnhancedError): void {
			handleError(error);
		},
		dispose(): void {
			// Cleanup if needed
		},
	});
}

/**
 * Create error logger instance
 */
export function createErrorLogger(): ErrorLogger {
	return Object.freeze({
		log(error: EnhancedError): void {
			const sanitizedMessage = sanitizeErrorMessage(error.message);
			console.error(`[Colors-LE] ${sanitizedMessage}`);
		},
		dispose(): void {
			// Cleanup if needed
		},
	});
}

/**
 * Create error notifier instance
 */
export function createErrorNotifier(): ErrorNotifier {
	return Object.freeze({
		notify(error: EnhancedError): void {
			const sanitizedMessage = sanitizeErrorMessage(error.userFriendlyMessage);
			console.warn(`[Colors-LE] ${sanitizedMessage}`);
		},
		dispose(): void {
			// Cleanup if needed
		},
	});
}

/**
 * Create performance error for performance monitoring
 */
export function createPerformanceError(
	operation: string,
	error: Error,
): EnhancedError {
	return createEnhancedError(
		error,
		'operational',
		{ operation },
		{
			recoverable: true,
			severity: 'medium',
			suggestion: localize(
				'runtime.performance.error.suggestion',
				'Consider optimizing the operation or reducing input size',
			),
		},
	);
}

/**
 * Error recovery strategies
 */
export interface ErrorRecoveryStrategy {
	canRecover(error: EnhancedError): boolean;
	recover(error: EnhancedError): Promise<boolean>;
}

/**
 * Default recovery strategies
 */
export const defaultRecoveryStrategies: ErrorRecoveryStrategy[] = [
	{
		canRecover(error: EnhancedError): boolean {
			return error.category === 'file-system' && error.recoverable;
		},
		async recover(_error: EnhancedError): Promise<boolean> {
			// For file system errors, we can retry after a delay
			await new Promise((resolve) => setTimeout(resolve, 1000));
			return true;
		},
	},
	{
		canRecover(error: EnhancedError): boolean {
			return error.category === 'configuration' && error.recoverable;
		},
		async recover(_error: EnhancedError): Promise<boolean> {
			// For configuration errors, we can fallback to defaults
			console.info('[Colors-LE] Falling back to default configuration');
			return true;
		},
	},
];

/**
 * Attempt to recover from an error using available strategies
 */
export async function attemptRecovery(error: EnhancedError): Promise<boolean> {
	for (const strategy of defaultRecoveryStrategies) {
		if (strategy.canRecover(error)) {
			try {
				const recovered = await strategy.recover(error);
				if (recovered) {
					console.info(
						`[Colors-LE] Successfully recovered from ${error.category} error`,
					);
					return true;
				}
			} catch (recoveryError) {
				console.error(`[Colors-LE] Recovery failed: ${recoveryError}`);
			}
		}
	}
	return false;
}

void localize;
