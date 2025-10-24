import { describe, expect, it } from 'vitest';
import {
	createEnhancedError,
	createErrorSummary,
	formatErrorSummary,
	getErrorRecoveryOptions,
	sanitizeErrorMessage,
} from './errorHandling';

describe('Error Handling', () => {
	describe('createEnhancedError', () => {
		it('should create enhanced error from string', () => {
			const error = createEnhancedError(
				new Error('Test error'),
				'parse',
				{ test: 'value' },
				{
					recoverable: true,
					severity: 'medium',
					suggestion: 'Test suggestion',
				},
			);

			expect(error.message).toBe('Test error');
			expect(error.category).toBe('parse');
			expect(error.recoverable).toBe(true);
			expect(error.severity).toBe('medium');
			expect(error.suggestion).toBe('Test suggestion');
		});

		it('should set default recoverable based on category', () => {
			const parsingError = createEnhancedError(
				new Error('Parse error'),
				'parse',
			);
			const safetyError = createEnhancedError(
				new Error('Safety error'),
				'safety',
			);

			expect(parsingError.recoverable).toBe(true);
			expect(safetyError.recoverable).toBe(false);
		});

		it('should set default severity based on category', () => {
			const parsingError = createEnhancedError(
				new Error('Parse error'),
				'parse',
			);
			const safetyError = createEnhancedError(
				new Error('Safety error'),
				'safety',
			);

			expect(parsingError.severity).toBe('medium');
			expect(safetyError.severity).toBe('medium');
		});
	});

	describe('getErrorRecoveryOptions', () => {
		it('should return recovery options for parsing error', () => {
			const error = createEnhancedError(new Error('Parse error'), 'parse');
			const options = getErrorRecoveryOptions(error);

			expect(options.retryable).toBe(false);
			expect(options.maxRetries).toBe(0);
		});

		it('should return recovery options for file system error', () => {
			const error = createEnhancedError(
				new Error('File error'),
				'file-system',
				{},
				{ recoverable: true },
			);
			const options = getErrorRecoveryOptions(error);

			expect(options.retryable).toBe(true);
			expect(options.maxRetries).toBe(3);
			expect(options.retryDelay).toBe(1000);
		});

		it('should return no recovery for non-recoverable error', () => {
			const error = createEnhancedError(new Error('Safety error'), 'safety');
			const options = getErrorRecoveryOptions(error);

			expect(options.retryable).toBe(false);
			expect(options.maxRetries).toBe(0);
		});
	});

	describe('sanitizeErrorMessage', () => {
		it('should sanitize file paths', () => {
			const message = 'Error in /home/user/file.css';
			const sanitized = sanitizeErrorMessage(message);

			expect(sanitized).toBe('Error in /home/***/file.css');
		});

		it('should sanitize tokens', () => {
			const message = 'Token abc123def456ghi789jkl012mno345pqr678';
			const sanitized = sanitizeErrorMessage(message);

			expect(sanitized).toBe('Token abc123def456ghi789jkl012mno345pqr678');
		});

		it('should sanitize passwords', () => {
			const message = 'password=secret123';
			const sanitized = sanitizeErrorMessage(message);

			expect(sanitized).toBe('password=***');
		});
	});

	describe('createErrorSummary', () => {
		it('should create summary from empty array', () => {
			const summary = createErrorSummary([]);

			expect(summary.totalErrors).toBe(0);
			expect(summary.recoverableErrors).toBe(0);
			expect(summary.nonRecoverableErrors).toBe(0);
		});

		it('should create summary from errors', () => {
			const errors = [
				createEnhancedError(new Error('Error 1'), 'parse'),
				createEnhancedError(new Error('Error 2'), 'safety'),
				createEnhancedError(new Error('Error 3'), 'validation'),
			];

			const summary = createErrorSummary(errors);

			expect(summary.totalErrors).toBe(3);
			expect(summary.recoverableErrors).toBe(2);
			expect(summary.nonRecoverableErrors).toBe(1);
			expect(summary.categories.parse).toBe(1);
			expect(summary.categories.safety).toBe(1);
			expect(summary.categories.validation).toBe(1);
		});
	});

	describe('formatErrorSummary', () => {
		it('should format empty summary', () => {
			const summary = createErrorSummary([]);
			const formatted = formatErrorSummary(summary);

			expect(formatted).toContain('Total Errors: 0');
		});

		it('should format summary with errors', () => {
			const errors = [
				createEnhancedError(new Error('Error 1'), 'parse'),
				createEnhancedError(new Error('Error 2'), 'safety'),
			];

			const summary = createErrorSummary(errors);
			const formatted = formatErrorSummary(summary);

			expect(formatted).toContain('Total Errors: 2');
			expect(formatted).toContain('Recoverable: 1');
			expect(formatted).toContain('Non-recoverable: 1');
		});
	});
});
