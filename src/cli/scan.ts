/**
 * One file end to end, as the Rust CLI's `scan.rs` does it, over the same
 * extraction engine the extension and the MCP server run.
 *
 * The report's shape and field order are the crate's, because stdout is
 * protocol: a script reading JSON Lines from `colors-le` cannot know which of
 * the two binaries it is talking to.
 */
import { readFileSync } from 'node:fs';
import { basename, sep } from 'node:path';
import { extractColors } from '../extraction/extract';
import { resolveFormat } from '../mcp/fileType';
import { decodeUtf8OrThrow, rustIoMessage } from './ioError';
import { type Palette, paletteContains } from './palette';

export interface ReportDiagnostic {
	readonly severity: 'warning' | 'error';
	readonly code: string;
	readonly message: string;
}

export interface FoundColor {
	readonly value: string;
	readonly notation: string;
	readonly line: number;
	readonly column: number;
	readonly inPalette?: boolean;
}

export interface FileReport {
	readonly file: string;
	readonly format: string;
	readonly colors: readonly FoundColor[];
	readonly diagnostics: readonly ReportDiagnostic[];
	readonly summary: {
		readonly colors: number;
		readonly outsidePalette: number;
	};
}

export interface ScanOptions {
	readonly dedupe: boolean;
	readonly format: string | null;
	readonly palette: Palette | null;
}

export type Examined =
	| { readonly kind: 'text'; readonly report: FileReport }
	| { readonly kind: 'binary' };

const BINARY_WINDOW = 8 * 1024;

export async function scanFile(
	path: string,
	options: ScanOptions,
): Promise<Examined> {
	const file = reportedPath(path);
	const format = options.format ?? resolveFormat(undefined, basename(path));

	let bytes: Buffer;
	try {
		bytes = readFileSync(path);
	} catch (error) {
		return text(skipped(file, format, rustIoMessage(error)));
	}
	if (looksBinary(bytes)) return { kind: 'binary' };

	const content = decodeUtf8(bytes);
	if (content === null) return text(skipped(file, format, 'not UTF-8 text'));
	return text(await scanContent(withoutBom(content), file, format, options));
}

export async function scanContent(
	content: string,
	file: string,
	format: string,
	options: ScanOptions,
): Promise<FileReport> {
	const { colors, diagnostics } = await extract(content, format);
	const judged = options.palette ? judge(colors, options.palette) : colors;
	const kept = options.dedupe ? firstOfEachValue(judged) : judged;
	const outsidePalette = kept.filter(
		(color) => color.inPalette === false,
	).length;

	return Object.freeze({
		file,
		format,
		colors: Object.freeze(kept),
		diagnostics: Object.freeze(diagnostics),
		summary: Object.freeze({ colors: kept.length, outsidePalette }),
	});
}

/**
 * 0 colours found and none outside the palette · 1 none found, or a colour
 * outside the palette · 2 could not answer. The crate's `exit_code`.
 */
export function exitCode(
	reports: readonly FileReport[],
	strict: boolean,
): number {
	if (reports.some(isIncomplete)) return 2;
	if (strict && reports.some(wasSkipped)) return 2;
	const outside = reports.reduce(
		(sum, report) => sum + report.summary.outsidePalette,
		0,
	);
	if (outside > 0) return 1;
	return reports.some((report) => report.summary.colors > 0) ? 0 : 1;
}

export function describe(report: FileReport, found: FoundColor): string {
	const mark = found.inPalette === false ? '  ← not in palette' : '';
	return `${report.file}:${found.line}:${found.column}  ${found.value}${mark}`;
}

/**
 * The engine refuses an empty document with a validation error, where the
 * crate reports no colours. A file that is empty holds no colours, so the
 * refusal is not asked for. A parse error is a scan that gave up part way and
 * is an `error`, which fails the run.
 */
async function extract(
	content: string,
	format: string,
): Promise<{ colors: FoundColor[]; diagnostics: ReportDiagnostic[] }> {
	if (!content.trim()) return { colors: [], diagnostics: [] };
	const result = await extractColors(content, format);
	const colors = result.colors.map((color) => ({
		value: color.value,
		notation: color.format,
		line: color.position?.line ?? 0,
		column: color.position?.column ?? 0,
	}));
	const diagnostics = result.errors.map((error) => ({
		severity: 'error' as const,
		code: error.type,
		message: error.message,
	}));
	return { colors, diagnostics };
}

function judge(colors: readonly FoundColor[], palette: Palette): FoundColor[] {
	return colors.map((color) => ({
		...color,
		inPalette: paletteContains(palette, color.value),
	}));
}

/** By value: `#FFF` and `#ffffff` are two findings, the same pixel spelled twice. */
function firstOfEachValue(colors: readonly FoundColor[]): FoundColor[] {
	const seen = new Set<string>();
	return colors.filter((color) => {
		if (seen.has(color.value)) return false;
		seen.add(color.value);
		return true;
	});
}

function isIncomplete(report: FileReport): boolean {
	return report.diagnostics.some(
		(diagnostic) => diagnostic.severity === 'error',
	);
}

function wasSkipped(report: FileReport): boolean {
	return report.diagnostics.some((diagnostic) => diagnostic.code === 'skipped');
}

function text(report: FileReport): Examined {
	return { kind: 'text', report };
}

function skipped(file: string, format: string, reason: string): FileReport {
	return Object.freeze({
		file,
		format,
		colors: Object.freeze([]),
		diagnostics: Object.freeze([
			{ severity: 'warning' as const, code: 'skipped', message: reason },
		]),
		summary: Object.freeze({ colors: 0, outsidePalette: 0 }),
	});
}

/** ripgrep's rule, as the crate uses it: a NUL byte in the first 8 KB. */
function looksBinary(bytes: Buffer): boolean {
	return bytes.subarray(0, BINARY_WINDOW).includes(0);
}

function decodeUtf8(bytes: Buffer): string | null {
	try {
		return decodeUtf8OrThrow(bytes);
	} catch {
		// Invalid UTF-8 is the answer, reported by the caller as a skip.
		return null;
	}
}

function withoutBom(content: string): string {
	return content.startsWith('﻿') ? content.slice(1) : content;
}

/** Separators are always `/` in a report, and only where `\` is the separator. */
function reportedPath(path: string): string {
	if (sep !== '\\') return path;
	return path.replaceAll('\\', '/');
}
