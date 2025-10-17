import { describe, expect, test } from 'vitest';
import { extractFromHtml } from './html';

describe('extractFromHtml', () => {
	test('extractFromHtml: style attributes', () => {
		const html = `
      <div style="color: #ff0000; background: rgb(0, 255, 0);">
      <span style="border-color: rgba(0, 0, 255, 0.5);">
    `;

		const result = extractFromHtml(html);

		expect(result.length).toBe(3);
		expect(result[0].value).toBe('#ff0000');
		expect(result[1].value).toBe('rgb(0, 255, 0)');
		expect(result[2].value).toBe('rgba(0, 0, 255, 0.5)');
	});

	test('extractFromHtml: style tags', () => {
		const html = `
      <style>
        .class { color: #ff0000; }
        .another { background: hsl(120, 100%, 50%); }
      </style>
    `;

		const result = extractFromHtml(html);

		expect(result.length).toBe(2);
		expect(result[0].value).toBe('#ff0000');
		expect(result[1].value).toBe('hsl(120, 100%, 50%)');
	});

	test('extractFromHtml: mixed style attributes and tags', () => {
		const html = `
      <div style="color: #ff0000;">
      <style>
        .class { background: rgb(0, 255, 0); }
      </style>
      <span style="border: rgba(0, 0, 255, 0.5);">
    `;

		const result = extractFromHtml(html);

		expect(result.length).toBe(3);
		expect(result[0].value).toBe('#ff0000');
		expect(result[1].value).toBe('rgb(0, 255, 0)');
		expect(result[2].value).toBe('rgba(0, 0, 255, 0.5)');
	});

	test('extractFromHtml: should not extract from comments', () => {
		const html = `
      <!-- This is a comment with #ff0000 -->
      <div style="color: #00ff00;">
      <!-- Another comment with rgb(255, 0, 0) -->
    `;

		const result = extractFromHtml(html);

		// Should only extract colors outside comments
		expect(result.length).toBe(1);
		expect(result[0].value).toBe('#00ff00');
	});

	test('extractFromHtml: should not extract from non-style contexts', () => {
		const html = `
      <a href="https://example.com/#ff0000">Link</a>
      <img src="image.jpg?color=rgb(0,255,0)" alt="Image">
      <div data-color="rgba(255,0,0,0.5)">Content</div>
    `;

		const result = extractFromHtml(html);

		// Should not extract colors from non-style contexts
		expect(result.length).toBe(0);
	});

	test('extractFromHtml: CSS properties in style attributes', () => {
		const html = `
      <div style="
        color: #ff0000;
        background-color: rgb(0, 255, 0);
        border-color: rgba(0, 0, 255, 0.5);
        box-shadow: 0 0 10px hsla(60, 100%, 50%, 0.8);
      ">
    `;

		const result = extractFromHtml(html);

		expect(result.length).toBe(4);
		expect(result[0].value).toBe('#ff0000');
		expect(result[1].value).toBe('rgb(0, 255, 0)');
		expect(result[2].value).toBe('rgba(0, 0, 255, 0.5)');
		expect(result[3].value).toBe('hsla(60, 100%, 50%, 0.8)');
	});

	test('extractFromHtml: short hex colors', () => {
		const html = `
      <div style="color: #f00; background: #0f0; border: #00f;">
    `;

		const result = extractFromHtml(html);

		expect(result.length).toBe(3);
		expect(result[0].value).toBe('#f00');
		expect(result[1].value).toBe('#0f0');
		expect(result[2].value).toBe('#00f');
	});

	test('extractFromHtml: hex colors with alpha', () => {
		const html = `
      <div style="color: #ff0000ff; background: #00ff0080;">
    `;

		const result = extractFromHtml(html);

		expect(result.length).toBe(2);
		expect(result[0].value).toBe('#ff0000ff');
		expect(result[1].value).toBe('#00ff0080');
	});

	test('extractFromHtml: malformed colors (should handle gracefully)', () => {
		const html = `
      <div style="color: #gggggg; background: rgb(300, 0, 0);">
    `;

		const result = extractFromHtml(html);

		// Should extract what it can and handle errors gracefully
		// Note: #gggggg is invalid hex and correctly NOT extracted
		// rgb(300, 0, 0) is extracted even though values are out of range (0-255)
		expect(result.length).toBe(1);
		expect(result[0].value).toBe('rgb(300, 0, 0)');
	});

	test('extractFromHtml: empty HTML', () => {
		const result = extractFromHtml('');
		expect(result.length).toBe(0);
	});

	test('extractFromHtml: whitespace only', () => {
		const result = extractFromHtml('   \n\t  ');
		expect(result.length).toBe(0);
	});

	test('extractFromHtml: position tracking', () => {
		const html = `
      <div style="color: #ff0000;">
    `;

		const result = extractFromHtml(html);

		expect(result.length).toBe(1);
		expect(result[0].position.line).toBe(2);
		expect(result[0].position.column > 0).toBeTruthy();
	});

	test('extractFromHtml: context tracking', () => {
		const html = `<div style="color: #ff0000;">`;

		const result = extractFromHtml(html);

		expect(result.length).toBe(1);
		expect(result[0].context).toBe(`<div style="color: #ff0000;">`);
	});

	test('extractFromHtml: large HTML file', () => {
		const divs = Array.from(
			{ length: 1000 },
			(_, i) =>
				`<div style="color: #${i.toString(16).padStart(6, '0')};">Content ${i}</div>`,
		);
		const html = divs.join('\n');

		const result = extractFromHtml(html);

		// Should extract all colors
		expect(result.length).toBe(1000);
		expect(result[0].value).toBe('#000000');
		expect(result[999].value).toBe('#0003e7');
	});

	test('extractFromHtml: nested style contexts', () => {
		const html = `
      <div style="color: #ff0000;">
        <span style="background: rgb(0, 255, 0);">
          <style>
            .nested { border: rgba(0, 0, 255, 0.5); }
          </style>
        </span>
      </div>
    `;

		const result = extractFromHtml(html);

		expect(result.length).toBe(3);
		expect(result[0].value).toBe('#ff0000');
		expect(result[1].value).toBe('rgb(0, 255, 0)');
		expect(result[2].value).toBe('rgba(0, 0, 255, 0.5)');
	});
});
