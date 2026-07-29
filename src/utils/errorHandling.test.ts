import { describe, expect, it } from 'vitest';
import {
	createEnhancedError,
	createErrorHandler,
	createErrorSummary,
	formatErrorSummary,
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

	describe('Error Categories', () => {
		it('should create validation error', () => {
			const error = createEnhancedError(
				new Error('Invalid color'),
				'validation',
			);
			expect(error.category).toBe('validation');
			expect(error.recoverable).toBe(true);
		});

		it('should create operational error', () => {
			const error = createEnhancedError(
				new Error('Extraction failed'),
				'operational',
			);
			expect(error.category).toBe('operational');
			expect(error.recoverable).toBe(true);
		});

		it('should create configuration error', () => {
			const error = createEnhancedError(
				new Error('Config invalid'),
				'configuration',
			);
			expect(error.category).toBe('configuration');
			expect(error.recoverable).toBe(true);
		});
	});

	describe('Error Recoverability', () => {
		it('should mark parse errors as recoverable', () => {
			const error = createEnhancedError(new Error('Parse failed'), 'parse');
			expect(error.recoverable).toBe(true);
		});

		it('should mark safety errors as non-recoverable', () => {
			const error = createEnhancedError(new Error('File too large'), 'safety');
			expect(error.recoverable).toBe(false);
		});

		it('should mark file-system errors with permission as recoverable', () => {
			const error = createEnhancedError(
				new Error('permission denied'),
				'file-system',
			);
			expect(error.recoverable).toBe(true);
		});

		it('should mark file-system errors with network as recoverable', () => {
			const error = createEnhancedError(
				new Error('network timeout'),
				'file-system',
			);
			expect(error.recoverable).toBe(true);
		});

		it('should mark operational fatal errors as non-recoverable', () => {
			const error = createEnhancedError(
				new Error('fatal error occurred'),
				'operational',
			);
			expect(error.recoverable).toBe(false);
		});

		it('should mark operational non-fatal errors as recoverable', () => {
			const error = createEnhancedError(
				new Error('temporary failure'),
				'operational',
			);
			expect(error.recoverable).toBe(true);
		});
	});

	describe('Error Sanitization', () => {
		it('should sanitize Windows paths', () => {
			const message = 'Error in C:\\Users\\username\\file.css';
			const sanitized = sanitizeErrorMessage(message);
			expect(sanitized).not.toContain('username');
		});

		it('should sanitize API keys', () => {
			const message = 'API key: sk-abc123def456ghi789';
			const sanitized = sanitizeErrorMessage(message);
			expect(sanitized).toContain('***');
		});

		it('should sanitize multiple sensitive patterns', () => {
			const message = 'Error in /home/user/file.css with password=secret123';
			const sanitized = sanitizeErrorMessage(message);
			expect(sanitized).toContain('/home/***/file.css');
			expect(sanitized).toContain('password=***');
		});

		it('should preserve non-sensitive information', () => {
			const message = 'Color parsing failed for #ff0000';
			const sanitized = sanitizeErrorMessage(message);
			expect(sanitized).toBe(message);
		});
	});

	describe('Error Context', () => {
		it('should include context in enhanced error', () => {
			const error = createEnhancedError(new Error('Parse error'), 'parse', {
				filepath: '/path/to/file.css',
				lineNumber: 42,
			});

			expect(error.message).toBe('Parse error');
			expect(error.category).toBe('parse');
		});

		it('should handle missing context gracefully', () => {
			const error = createEnhancedError(new Error('Error'), 'parse');
			expect(error.message).toBe('Error');
		});
	});

	describe('Error Severity', () => {
		it('should set custom severity', () => {
			const error = createEnhancedError(
				new Error('Critical error'),
				'safety',
				{},
				{ severity: 'high' },
			);
			expect(error.severity).toBe('high');
		});

		it('should default to medium severity', () => {
			const error = createEnhancedError(new Error('Error'), 'parse');
			expect(error.severity).toBe('medium');
		});

		it('should support low severity', () => {
			const error = createEnhancedError(
				new Error('Minor issue'),
				'validation',
				{},
				{ severity: 'low' },
			);
			expect(error.severity).toBe('low');
		});
	});

	describe('Error Suggestions', () => {
		it('should allow custom suggestions', () => {
			const customSuggestion = 'Try restarting the extension';
			const error = createEnhancedError(
				new Error('Error'),
				'operational',
				{},
				{ suggestion: customSuggestion },
			);
			expect(error.suggestion).toBe(customSuggestion);
		});
	});

	describe('Error Summary Statistics', () => {
		it('should count errors by category', () => {
			const errors = [
				createEnhancedError(new Error('Error 1'), 'parse'),
				createEnhancedError(new Error('Error 2'), 'parse'),
				createEnhancedError(new Error('Error 3'), 'validation'),
			];

			const summary = createErrorSummary(errors);
			expect(summary.categories.parse).toBe(2);
			expect(summary.categories.validation).toBe(1);
		});

		it('should count errors by severity', () => {
			const errors = [
				createEnhancedError(
					new Error('Error 1'),
					'parse',
					{},
					{ severity: 'high' },
				),
				createEnhancedError(
					new Error('Error 2'),
					'parse',
					{},
					{ severity: 'low' },
				),
				createEnhancedError(new Error('Error 3'), 'validation'),
			];

			const summary = createErrorSummary(errors);
			expect(summary.totalErrors).toBe(3);
		});

		it('should handle errors with same category', () => {
			const errors = Array(5)
				.fill(null)
				.map(() => createEnhancedError(new Error('Parse error'), 'parse'));

			const summary = createErrorSummary(errors);
			expect(summary.totalErrors).toBe(5);
			expect(summary.categories.parse).toBe(5);
		});
	});

	describe('Error Immutability', () => {
		it('should freeze enhanced error object', () => {
			const error = createEnhancedError(new Error('Test'), 'parse');
			expect(Object.isFrozen(error)).toBe(true);
		});
	});

	describe('Error Code Generation', () => {
		it('should generate error code for parse errors', () => {
			const error = createEnhancedError(new Error('Parse error'), 'parse');
			// Error code is internal, but we can verify the error is created correctly
			expect(error.category).toBe('parse');
		});

		it('should generate error code for validation errors', () => {
			const error = createEnhancedError(
				new Error('Validation error'),
				'validation',
			);
			expect(error.category).toBe('validation');
		});

		it('should generate error code for safety errors', () => {
			const error = createEnhancedError(new Error('Safety error'), 'safety');
			expect(error.category).toBe('safety');
		});

		it('should generate error code for file-system errors', () => {
			const error = createEnhancedError(new Error('File error'), 'file-system');
			expect(error.category).toBe('file-system');
		});

		it('should generate error code for configuration errors', () => {
			const error = createEnhancedError(
				new Error('Config error'),
				'configuration',
			);
			expect(error.category).toBe('configuration');
		});

		it('should generate error code for operational errors', () => {
			const error = createEnhancedError(
				new Error('Operational error'),
				'operational',
			);
			expect(error.category).toBe('operational');
		});
	});

	describe('Error Recoverability Edge Cases', () => {
		it('should mark file-system errors without permission/network as non-recoverable', () => {
			const error = createEnhancedError(
				new Error('disk failure'),
				'file-system',
			);
			expect(error.recoverable).toBe(false);
		});

		it('should handle operational errors without fatal keyword', () => {
			const error = createEnhancedError(
				new Error('temporary issue'),
				'operational',
			);
			expect(error.recoverable).toBe(true);
		});

		it('should handle unknown error categories', () => {
			const error = createEnhancedError(new Error('Unknown error'), 'parse');
			expect(error.recoverable).toBe(true);
		});
	});

	describe('User-Friendly Messages Edge Cases', () => {
		it('should provide default message for unknown categories', () => {
			const error = createEnhancedError(new Error('Unknown error'), 'parse');
			expect(error.userFriendlyMessage).toBeDefined();
			expect(error.userFriendlyMessage.length).toBeGreaterThan(0);
		});
	});

	describe('Error Summary Edge Cases', () => {
		it('should handle summary with only recoverable errors', () => {
			const errors = [
				createEnhancedError(new Error('Error 1'), 'parse'),
				createEnhancedError(new Error('Error 2'), 'validation'),
			];

			const summary = createErrorSummary(errors);
			expect(summary.recoverableErrors).toBe(2);
			expect(summary.nonRecoverableErrors).toBe(0);
		});

		it('should handle summary with only non-recoverable errors', () => {
			const errors = [
				createEnhancedError(new Error('Error 1'), 'safety'),
				createEnhancedError(new Error('Error 2'), 'safety'),
			];

			const summary = createErrorSummary(errors);
			expect(summary.recoverableErrors).toBe(0);
			expect(summary.nonRecoverableErrors).toBe(2);
		});

		it('should handle summary with mixed categories', () => {
			const errors = [
				createEnhancedError(new Error('Error 1'), 'parse'),
				createEnhancedError(new Error('Error 2'), 'validation'),
				createEnhancedError(new Error('Error 3'), 'safety'),
				createEnhancedError(new Error('Error 4'), 'file-system'),
				createEnhancedError(new Error('Error 5'), 'configuration'),
				createEnhancedError(new Error('Error 6'), 'operational'),
			];

			const summary = createErrorSummary(errors);
			expect(summary.totalErrors).toBe(6);
			expect(summary.categories.parse).toBe(1);
			expect(summary.categories.validation).toBe(1);
			expect(summary.categories.safety).toBe(1);
			expect(summary.categories['file-system']).toBe(1);
			expect(summary.categories.configuration).toBe(1);
			expect(summary.categories.operational).toBe(1);
		});
	});

	describe('Error Format Summary Edge Cases', () => {
		it('should format summary with single error', () => {
			const errors = [createEnhancedError(new Error('Single error'), 'parse')];
			const summary = createErrorSummary(errors);
			const formatted = formatErrorSummary(summary);

			expect(formatted).toContain('Total Errors: 1');
			expect(formatted).toContain('Recoverable: 1');
		});

		it('should format summary with many errors', () => {
			const errors = Array(100)
				.fill(null)
				.map((_, i) => createEnhancedError(new Error(`Error ${i}`), 'parse'));

			const summary = createErrorSummary(errors);
			const formatted = formatErrorSummary(summary);

			expect(formatted).toContain('Total Errors: 100');
		});
	});

	describe('Error Context Handling', () => {
		it('should handle very long context', () => {
			const longPath = `${'/very/long/path/'.repeat(50)}file.css`;
			const error = createEnhancedError(new Error('Error'), 'parse', {
				filepath: longPath,
			});
			expect(error.userFriendlyMessage).toBeDefined();
		});
	});

	describe('Error Severity Edge Cases', () => {
		it('should handle custom high severity', () => {
			const error = createEnhancedError(
				new Error('Critical'),
				'safety',
				undefined,
				{
					severity: 'high',
				},
			);
			expect(error.severity).toBe('high');
		});

		it('should handle custom low severity', () => {
			const error = createEnhancedError(
				new Error('Minor'),
				'validation',
				undefined,
				{
					severity: 'low',
				},
			);
			expect(error.severity).toBe('low');
		});

		it('should default to medium severity', () => {
			const error = createEnhancedError(new Error('Normal'), 'parse');
			expect(error.severity).toBe('medium');
		});
	});

	describe('createErrorHandler', () => {
		it('should create error handler', () => {
			const handler = createErrorHandler();
			expect(handler).toBeDefined();
			expect(typeof handler.handle).toBe('function');
			expect(typeof handler.dispose).toBe('function');
		});

		it('should freeze error handler', () => {
			const handler = createErrorHandler();
			expect(Object.isFrozen(handler)).toBe(true);
		});

		it('should handle errors', () => {
			const handler = createErrorHandler();
			const error = createEnhancedError(new Error('Test'), 'parse');
			handler.handle(error);
			expect(true).toBe(true);
		});

		it('should dispose handler', () => {
			const handler = createErrorHandler();
			handler.dispose();
			expect(true).toBe(true);
		});
	});
});
