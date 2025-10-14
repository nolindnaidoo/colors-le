# Colors-LE Testing Guide

## Overview

Vitest powers the testing framework with V8 coverage reporting. Current v1.0.0 achieves 55% overall coverage with 92 passing tests. Core extraction modules have 89% coverage. Integration and command-level tests are targeted for v1.1.0 to reach 80% overall coverage.

## Framework Setup

### Vitest Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      // Target for v1.1.0: 80% threshold
      // Current v1.0.0: 55% overall, 89% extraction
    },
  },
})
```

### Test Structure

```
src/
├── commands/           # Command logic tests
├── extraction/         # Extraction pipeline tests
├── utils/              # Utility function tests
└── __mocks__/          # VS Code API mocks
```

## Test Categories

### Unit Tests

Test pure functions in isolation:

```typescript
// utils/colorConversion.test.ts
describe('Color Conversion', () => {
  it('parses hex colors correctly', () => {
    expect(parseColor('#ff0000')).toEqual({ r: 255, g: 0, b: 0, a: 1 })
  })

  it('converts RGB to HSL accurately', () => {
    expect(rgbToHsl(255, 0, 0)).toEqual({ h: 0, s: 100, l: 50 })
  })

  it('handles invalid input gracefully', () => {
    expect(parseColor('invalid')).toBeNull()
  })
})
```

### Integration Tests

Test component workflows:

```typescript
// commands/extract.test.ts
describe('Extract Command', () => {
  it('completes full extraction pipeline', async () => {
    const css = '.primary { color: #ff0000; }'
    const result = await extractColors(css, 'css')

    expect(result.success).toBe(true)
    expect(result.colors).toHaveLength(1)
    expect(result.colors[0].value).toBe('#ff0000')
  })
})
```

### Performance Tests

Validate throughput and resource usage:

```typescript
// performance/largeFiles.test.ts
describe('Large File Processing', () => {
  it('extracts 1MB file under 1 second', () => {
    const content = generateLargeCssFile(1024 * 1024)
    const startTime = performance.now()

    extractColors(content, 'css')

    expect(performance.now() - startTime).toBeLessThan(1000)
  })

  it('maintains memory under 50MB', () => {
    const initial = process.memoryUsage().heapUsed

    extractColors(generateLargeCssFile(5 * 1024 * 1024), 'css')

    const increase = process.memoryUsage().heapUsed - initial
    expect(increase).toBeLessThan(50 * 1024 * 1024)
  })
})
```

## Running Tests

```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage report
npm test -- extraction      # Specific tests
```

## Coverage Status (v1.0.0)

- **Current**: 55% overall, 89% extraction modules  
- **Tests**: 92 passing across 6 test suites
- **Target (v1.1.0)**: 80% across all metrics
- **Reports**: HTML and JSON generated in `coverage/`

## Test Utilities

### Mock VS Code API

```typescript
// __mocks__/vscode.ts
export const window = {
  showInformationMessage: vi.fn(),
  createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(),
    show: vi.fn(),
  })),
}
```

### Test Data Generators

```typescript
export function generateLargeCssFile(bytes: number): string {
  const colors = ['#ff0000', '#00ff00', '#0000ff']
  let content = ''

  while (content.length < bytes) {
    const color = colors[Math.floor(Math.random() * colors.length)]
    content += `.class-${Math.random().toString(36)} { color: ${color}; }\n`
  }

  return content
}
```

## Quality Assurance

### Test Writing Principles

1. **Arrange-Act-Assert**: Structure tests clearly
2. **Single Responsibility**: One assertion focus per test
3. **Independence**: No test interdependencies
4. **Speed**: Keep execution under 100ms per test
5. **Descriptive**: Use meaningful test names

### Performance Benchmarks

| File Size | Colors  | Max Duration | Max Memory |
| --------- | ------- | ------------ | ---------- |
| 1KB       | ~10     | 10ms         | 1MB        |
| 100KB     | ~1,000  | 100ms        | 10MB       |
| 1MB       | ~10,000 | 1,000ms      | 50MB       |

## Continuous Integration

Tests run automatically on push via GitHub Actions:

```yaml
- name: Run tests
  run: npm test

- name: Generate coverage
  run: npm run test:coverage

- name: Upload to Codecov
  uses: codecov/codecov-action@v3
```

## Troubleshooting

- **Slow tests**: Profile with `--reporter=verbose`
- **Memory leaks**: Use `process.memoryUsage()` tracking
- **Mock issues**: Verify VS Code API mock implementations
- **Flaky tests**: Isolate async operations and use proper cleanup

---

**Related:** [Architecture](ARCHITECTURE.md) | [Performance](PERFORMANCE.md) | [Development](DEVELOPMENT.md)
