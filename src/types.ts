export interface ExtractionResult {
	readonly success: boolean;
	readonly colors: readonly Color[];
	readonly errors: readonly ParseError[];
	readonly warnings: readonly string[];
	readonly metadata?:
		| {
				readonly fileType: FileType;
				readonly totalLines: number;
				readonly processedLines: number;
				readonly processingTimeMs: number;
		  }
		| undefined;
}

export interface ParseError {
	readonly type: 'parse-error' | 'validation-error';
	readonly message: string;
	readonly filepath?: string | undefined;
	readonly line?: number | undefined;
	readonly column?: number | undefined;
	readonly context?: string | undefined;
}

export interface Color {
	readonly value: string;
	readonly format: ColorFormat;
	readonly position?:
		| {
				readonly line: number;
				readonly column: number;
		  }
		| undefined;
	readonly context?: string | undefined;
}

export type ColorFormat =
	| 'hex'
	| 'rgb'
	| 'rgba'
	| 'hsl'
	| 'hsla'
	| 'named'
	| 'unknown';

export type FileType =
	| 'css'
	| 'html'
	| 'javascript'
	| 'typescript'
	| 'svg'
	| 'scss'
	| 'less'
	| 'stylus'
	| 'unknown';

export type SortMode =
	| 'off'
	| 'hue-asc'
	| 'hue-desc'
	| 'saturation-asc'
	| 'saturation-desc'
	| 'lightness-asc'
	| 'lightness-desc'
	| 'hex-asc'
	| 'hex-desc';

export interface Configuration {
	readonly copyToClipboardEnabled: boolean;
	readonly dedupeEnabled: boolean;
	readonly notificationsLevel: 'all' | 'important' | 'silent';
	readonly openResultsSideBySide: boolean;
	readonly safetyEnabled: boolean;
	readonly safetyFileSizeWarnBytes: number;
	readonly safetyLargeOutputLinesThreshold: number;
	readonly sortMode: SortMode;
	readonly statusBarEnabled: boolean;
	readonly telemetryEnabled: boolean;
}
