import type { Color } from '../types';

/**
 * Shapes shared by the filter command and its prompt module. They live here so
 * the two can import them without importing each other.
 */
export interface ColorFilterOptions {
	readonly formats?: readonly string[] | undefined;
	readonly excludeFormats?: readonly string[] | undefined;
	readonly minLightness?: number | undefined;
	readonly maxLightness?: number | undefined;
	readonly minSaturation?: number | undefined;
	readonly maxSaturation?: number | undefined;
	readonly hueRange?: { min: number; max: number } | undefined;
	readonly excludeDuplicates?: boolean | undefined;
	readonly excludeInvalid?: boolean | undefined;
	readonly excludeTransparent?: boolean | undefined;
	readonly customPattern?: string | undefined;
}

export interface ColorFilterResult {
	readonly original: readonly Color[];
	readonly filtered: readonly Color[];
	readonly excluded: readonly Color[];
	readonly options: ColorFilterOptions;
	readonly timestamp: number;
	readonly summary: {
		readonly total: number;
		readonly kept: number;
		readonly excluded: number;
		readonly exclusionReasons: readonly { reason: string; count: number }[];
	};
}
