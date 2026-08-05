import type { Color } from '../types';

/**
 * Shapes shared by the validate command and its prompt module.
 *
 * They live here rather than in validate.ts so the prompts can import them
 * without the two files importing each other.
 */
export interface ColorValidationOptions {
	readonly checkContrast?: boolean | undefined;
	readonly contrastBackground?: string | undefined;
	readonly minContrastAA?: number | undefined;
	readonly minContrastAAA?: number | undefined;
	readonly checkFormat?: boolean | undefined;
	readonly checkAccessibility?: boolean | undefined;
	readonly checkColorBlindness?: boolean | undefined;
	readonly allowedFormats?: readonly string[] | undefined;
	readonly customRules?: readonly ValidationRule[] | undefined;
}

export interface ValidationRule {
	readonly name: string;
	readonly description: string;
	readonly test: (color: string) => boolean;
	readonly severity: 'error' | 'warning' | 'info';
	readonly suggestion?: string | undefined;
}

export interface ColorValidationResult {
	readonly color: Color;
	readonly valid: boolean;
	readonly issues: readonly ValidationIssue[];
	readonly suggestions: readonly string[];
	readonly contrastRatio?: number | undefined;
	readonly accessibilityLevel?: 'AA' | 'AAA' | 'fail' | undefined;
}

export interface ValidationIssue {
	readonly type: 'format' | 'contrast' | 'accessibility' | 'custom';
	readonly severity: 'error' | 'warning' | 'info';
	readonly message: string;
	readonly suggestion?: string | undefined;
}

export interface ValidationReport {
	readonly colors: readonly ColorValidationResult[];
	readonly summary: {
		readonly total: number;
		readonly valid: number;
		readonly invalid: number;
		readonly warnings: number;
		readonly errors: number;
	};
	readonly options: ColorValidationOptions;
	readonly timestamp: number;
}
