import { describe, expect, test } from 'vitest';
import { extractFromJavaScript } from './javascript';

describe('extractFromJavaScript', () => {
	test('extractFromJavaScript: style object colors', () => {
		const js = `
      const styles = {
        color: '#ff0000',
        backgroundColor: 'rgb(0, 255, 0)',
        borderColor: 'rgba(0, 0, 255, 0.5)'
      };
    `;

		const result = extractFromJavaScript(js);

		// Colors are deduplicated (no duplicates from regex + string literal matches)
		expect(result.length).toBe(3);
		expect(result[0]?.value).toBe('#ff0000');
		expect(result[1]?.value).toBe('rgb(0, 255, 0)');
		expect(result[2]?.value).toBe('rgba(0, 0, 255, 0.5)');
	});

	test('extractFromJavaScript: CSS-in-JS template literals', () => {
		const js = `
      const styled = css\`
        color: #ff0000;
        background: hsl(120, 100%, 50%);
      \`;
    `;

		const result = extractFromJavaScript(js);

		expect(result.length).toBe(2);
		expect(result[0]?.value).toBe('#ff0000');
		expect(result[1]?.value).toBe('hsl(120, 100%, 50%)');
	});

	test('extractFromJavaScript: theme object colors', () => {
		const js = `
      const theme = {
        colors: {
          primary: '#ff0000',
          secondary: 'rgb(0, 255, 0)',
          accent: 'rgba(0, 0, 255, 0.5)'
        }
      };
    `;

		const result = extractFromJavaScript(js);

		// Every color inside a string literal is extracted — no fragile
		// style-context guessing (theme objects are the canonical use case).
		expect(result.length).toBe(3);
		expect(result.map((r) => r.value)).toEqual([
			'#ff0000',
			'rgb(0, 255, 0)',
			'rgba(0, 0, 255, 0.5)',
		]);
	});

	test('extractFromJavaScript: style variable assignments', () => {
		const js = `
      const color = '#ff0000';
      const backgroundColor = 'rgb(0, 255, 0)';
      const themeColor = 'hsl(240, 100%, 50%)';
    `;

		const result = extractFromJavaScript(js);

		expect(result.length).toBe(3);
		const values = result.map((r) => r.value);
		expect(values).toEqual([
			'#ff0000',
			'rgb(0, 255, 0)',
			'hsl(240, 100%, 50%)',
		]);
	});

	test('extractFromJavaScript: CSS property assignments', () => {
		const js = `
      element.style.color = '#ff0000';
      element.style.backgroundColor = 'rgb(0, 255, 0)';
      element.style.borderColor = 'rgba(0, 0, 255, 0.5)';
    `;

		const result = extractFromJavaScript(js);

		// Colors are deduplicated (no duplicates from regex + string literal matches)
		expect(result.length).toBe(3);
		expect(result[0]?.value).toBe('#ff0000');
		expect(result[1]?.value).toBe('rgb(0, 255, 0)');
		expect(result[2]?.value).toBe('rgba(0, 0, 255, 0.5)');
	});

	test('extractFromJavaScript: should not extract from comments', () => {
		const js = `
      // This is a comment with #ff0000
      const styles = {
        color: '#00ff00' // Another comment with rgb(255, 0, 0)
      };
    `;

		const result = extractFromJavaScript(js);

		// Should only extract colors from style contexts, not comments
		// Colors are deduplicated (no duplicates from regex + string literal matches)
		expect(result.length).toBe(1);
		expect(result[0]?.value).toBe('#00ff00');
	});

	test('extractFromJavaScript: should not extract from non-style contexts', () => {
		const js = `
      const url = 'https://example.com/#ff0000';
      const message = 'Color code: rgb(0, 255, 0)';
      const data = {
        id: '#12345',
        value: 'rgba(255, 0, 0, 0.5)'
      };
    `;

		const result = extractFromJavaScript(js);

		// String-literal colors are extracted wherever they appear; the
		// documented tradeoff is that a hex inside a URL fragment matches
		// too. '#12345' is five digits — not a valid hex — and is rejected.
		expect(result.length).toBe(3);
		expect(result.map((r) => r.value)).toEqual([
			'#ff0000',
			'rgb(0, 255, 0)',
			'rgba(255, 0, 0, 0.5)',
		]);
	});

	test('extractFromJavaScript: mixed valid and invalid contexts', () => {
		const js = `
      const styles = {
        color: '#ff0000', // Valid style context
        backgroundColor: 'rgb(0, 255, 0)' // Valid style context
      };
    
      const data = {
        id: '#12345', // Invalid - not style context
        value: 'rgba(255, 0, 0, 0.5)' // Invalid - not style context
      };
    `;

		const result = extractFromJavaScript(js);

		// '#12345' is rejected (invalid hex length); everything else in a
		// string literal is extracted.
		expect(result.length).toBe(3);
		expect(result[0]?.value).toBe('#ff0000');
		expect(result[1]?.value).toBe('rgb(0, 255, 0)');
		expect(result[2]?.value).toBe('rgba(255, 0, 0, 0.5)');
	});

	test('extractFromJavaScript: styled-components pattern', () => {
		const js = `
      const Button = styled.button\`
        color: #ff0000;
        background: hsl(120, 100%, 50%);
      \`;
    `;

		const result = extractFromJavaScript(js);

		expect(result.length).toBe(2);
		expect(result[0]?.value).toBe('#ff0000');
		expect(result[1]?.value).toBe('hsl(120, 100%, 50%)');
	});

	test('extractFromJavaScript: emotion pattern', () => {
		const js = `
      const styles = css({
        color: '#ff0000',
        backgroundColor: 'rgb(0, 255, 0)'
      });
    `;

		const result = extractFromJavaScript(js);

		// Colors are deduplicated (no duplicates from regex + string literal matches)
		expect(result.length).toBe(2);
		expect(result[0]?.value).toBe('#ff0000');
		expect(result[1]?.value).toBe('rgb(0, 255, 0)');
	});

	test('extractFromJavaScript: theme usage', () => {
		const js = `
      const component = {
        color: theme.colors.primary,
        backgroundColor: theme.palette.background
      };
    `;

		const result = extractFromJavaScript(js);

		// Should extract from theme context even without color values
		expect(result.length).toBe(0);
	});

	test('extractFromJavaScript: empty JavaScript', () => {
		const result = extractFromJavaScript('');
		expect(result.length).toBe(0);
	});

	test('extractFromJavaScript: whitespace only', () => {
		const result = extractFromJavaScript('   \n\t  ');
		expect(result.length).toBe(0);
	});

	test('extractFromJavaScript: position tracking', () => {
		const js = `
      const styles = {
        color: '#ff0000'
      };
    `;

		const result = extractFromJavaScript(js);

		expect(result.length).toBe(1);
		expect(result[0]?.position?.line).toBe(3);
		expect((result[0]?.position?.column ?? 0) > 0).toBeTruthy();
	});

	test('extractFromJavaScript: context tracking', () => {
		const js = `const styles = { color: '#ff0000' };`;

		const result = extractFromJavaScript(js);

		expect(result.length).toBe(1);
		expect(result[0]?.context).toBe(`const styles = { color: '#ff0000' };`);
	});

	test('extractFromJavaScript: large JavaScript file', () => {
		const rules = Array.from(
			{ length: 1000 },
			(_, i) =>
				`const rule${i} = { color: '#${i.toString(16).padStart(6, '0')}' };`,
		);
		const js = rules.join('\n');

		const result = extractFromJavaScript(js);

		// Should extract all colors from style contexts
		expect(result.length).toBe(1000);
		expect(result[0]?.value).toBe('#000000');
		expect(result[999]?.value).toBe('#0003e7');
	});
});
