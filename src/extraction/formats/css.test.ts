import { describe, expect, it } from 'vitest';
import { extractFromCss } from './css';

describe('extractFromCss', () => {
	it('should extract hex colors', () => {
		const css = `.class { color: #ff0000; background: #00ff00; }`;
		const result = extractFromCss(css);

		expect(result.length).toBe(2);
		expect(result[0].value).toBe('#ff0000');
		expect(result[0].format).toBe('hex');
		expect(result[1].value).toBe('#00ff00');
		expect(result[1].format).toBe('hex');
	});

	it('should extract RGB colors', () => {
		const css = `.class { color: rgb(255, 0, 0); background: rgb(0, 255, 0); }`;
		const result = extractFromCss(css);

		expect(result.length).toBe(2);
		expect(result[0].value).toBe('rgb(255, 0, 0)');
		expect(result[0].format).toBe('rgb');
		expect(result[1].value).toBe('rgb(0, 255, 0)');
		expect(result[1].format).toBe('rgb');
	});

	it('should extract RGBA colors', () => {
		const css = `.class { color: rgba(255, 0, 0, 0.5); background: rgba(0, 255, 0, 1); }`;
		const result = extractFromCss(css);

		expect(result.length).toBe(2);
		expect(result[0].value).toBe('rgba(255, 0, 0, 0.5)');
		expect(result[0].format).toBe('rgba');
		expect(result[1].value).toBe('rgba(0, 255, 0, 1)');
		expect(result[1].format).toBe('rgba');
	});

	it('should extract HSL colors', () => {
		const css = `.class { color: hsl(120, 100%, 50%); background: hsl(240, 50%, 25%); }`;
		const result = extractFromCss(css);

		expect(result.length).toBe(2);
		expect(result[0].value).toBe('hsl(120, 100%, 50%)');
		expect(result[0].format).toBe('hsl');
		expect(result[1].value).toBe('hsl(240, 50%, 25%)');
		expect(result[1].format).toBe('hsl');
	});

	it('should extract HSLA colors', () => {
		const css = `.class { color: hsla(120, 100%, 50%, 0.8); background: hsla(240, 50%, 25%, 0.3); }`;
		const result = extractFromCss(css);

		expect(result.length).toBe(2);
		expect(result[0].value).toBe('hsla(120, 100%, 50%, 0.8)');
		expect(result[0].format).toBe('hsla');
		expect(result[1].value).toBe('hsla(240, 50%, 25%, 0.3)');
		expect(result[1].format).toBe('hsla');
	});

	it('should extract mixed color formats', () => {
		const css = `
      .mixed {
        color: #ff0000;
        background: rgb(0, 255, 0);
        border: rgba(0, 0, 255, 0.5);
        text-shadow: hsl(60, 100%, 50%);
        box-shadow: hsla(300, 100%, 50%, 0.8);
      }
    `;

		const result = extractFromCss(css);

		expect(result.length).toBe(5);
		expect(result[0].value).toBe('#ff0000');
		expect(result[1].value).toBe('rgb(0, 255, 0)');
		expect(result[2].value).toBe('rgba(0, 0, 255, 0.5)');
		expect(result[3].value).toBe('hsl(60, 100%, 50%)');
		expect(result[4].value).toBe('hsla(300, 100%, 50%, 0.8)');
	});

	it('should extract short hex colors', () => {
		const css = `.class { color: #f00; background: #0f0; border: #00f; }`;
		const result = extractFromCss(css);

		expect(result.length).toBe(3);
		expect(result[0].value).toBe('#f00');
		expect(result[1].value).toBe('#0f0');
		expect(result[2].value).toBe('#00f');
	});

	it('should extract hex colors with alpha', () => {
		const css = `.class { color: #ff0000ff; background: #00ff0080; }`;
		const result = extractFromCss(css);

		expect(result.length).toBe(2);
		expect(result[0].value).toBe('#ff0000ff');
		expect(result[1].value).toBe('#00ff0080');
	});

	it('should handle CSS variables (not extract var() references)', () => {
		const css = `
      :root {
        --primary-color: #ff0000;
        --secondary-color: rgb(0, 255, 0);
      }
      .class {
        color: var(--primary-color);
      }
    `;

		const result = extractFromCss(css);

		// Should extract colors from CSS variables but not the var() references
		expect(result.length).toBe(2);
		expect(result[0].value).toBe('#ff0000');
		expect(result[1].value).toBe('rgb(0, 255, 0)');
	});

	it('should not extract colors from comments', () => {
		const css = `
      /* This is a comment with #ff0000 */
      .class {
        color: #00ff00; /* Another comment with rgb(255, 0, 0) */
      }
    `;

		const result = extractFromCss(css);

		// Should only extract colors outside comments
		expect(result.length).toBe(1);
		expect(result[0].value).toBe('#00ff00');
	});

	it('should handle malformed colors gracefully', () => {
		const css = `
      .class {
        color: #gggggg; /* Invalid hex - won't match pattern */
        background: rgb(300, 0, 0); /* Out of range but valid pattern */
        border: hsl(400, 100%, 50%); /* Out of range but valid pattern */
      }
    `;

		const result = extractFromCss(css);

		// Should extract only valid patterns (regex matches)
		// #gggggg is invalid hex chars, so regex won't match it (correct)
		// rgb/hsl with out-of-range values still match the pattern
		expect(result.length).toBe(2);
		expect(result[0].value).toBe('rgb(300, 0, 0)');
		expect(result[1].value).toBe('hsl(400, 100%, 50%)');
	});

	it('should handle empty CSS', () => {
		const result = extractFromCss('');
		expect(result.length).toBe(0);
	});

	it('should handle whitespace only', () => {
		const result = extractFromCss('   \n\t  ');
		expect(result.length).toBe(0);
	});

	it('should track position', () => {
		const css = `
      .class {
        color: #ff0000;
      }
    `;

		const result = extractFromCss(css);

		expect(result.length).toBe(1);
		expect(result[0].position.line).toBe(3);
		expect(result[0].position.column).toBeGreaterThan(0);
	});

	it('should track context', () => {
		const css = `.class { color: #ff0000; }`;

		const result = extractFromCss(css);

		expect(result.length).toBe(1);
		expect(result[0].context).toBe('.class { color: #ff0000; }');
	});

	it('should handle large CSS file', () => {
		const rules = Array.from(
			{ length: 1000 },
			(_, i) => `.rule-${i} { color: #${i.toString(16).padStart(6, '0')}; }`,
		);
		const css = rules.join('\n');

		const result = extractFromCss(css);

		// Should extract all colors
		expect(result.length).toBe(1000);
		expect(result[0].value).toBe('#000000');
		expect(result[999].value).toBe('#0003e7');
	});
});
