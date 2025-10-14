# Colors-LE Development Guide

This document provides comprehensive guidance for developing, testing, and contributing to the Colors-LE VS Code extension.

## Getting Started

### Prerequisites

- **Node.js**: Version 18 or higher
- **VS Code**: Version 1.80 or higher
- **TypeScript**: Version 5.0 or higher
- **Git**: For version control

### Development Environment Setup

1. **Clone the repository**:

   ```bash
   git clone <repository-url>
   cd colors-le
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Build the extension**:

   ```bash
   npm run build
   ```

4. **Run tests**:

   ```bash
   npm test
   ```

5. **Open in VS Code**:
   ```bash
   code .
   ```

## Project Structure

```
colors-le/
├── src/                    # Source code
│   ├── extension.ts        # Extension entry point
│   ├── types.ts           # Type definitions
│   ├── commands/          # Command implementations
│   │   ├── index.ts       # Command registration
│   │   ├── extract.ts     # Extract colors command
│   │   ├── dedupe.ts      # Deduplicate colors command
│   │   ├── sort.ts        # Sort colors command
│   │   ├── analyze.ts     # Analyze colors command
│   │   └── help.ts        # Help command
│   ├── config/            # Configuration management
│   │   ├── config.ts      # Configuration reader
│   │   └── settings.ts    # Settings command
│   ├── extraction/        # Color extraction engine
│   │   ├── extract.ts     # Main extraction router
│   │   └── formats/       # Format-specific extractors
│   │       ├── css.ts     # CSS color extraction
│   │       ├── scss.ts    # SCSS color extraction
│   │       ├── javascript.ts # JavaScript color extraction
│   │       ├── json.ts    # JSON color extraction
│   │       ├── yaml.ts    # YAML color extraction
│   │       └── html.ts    # HTML color extraction
│   ├── ui/                # User interface components
│   │   ├── notifier.ts    # Notification system
│   │   └── statusBar.ts   # Status bar management
│   ├── telemetry/         # Telemetry and logging
│   │   └── telemetry.ts   # Local telemetry
│   ├── utils/             # Utility functions
│   │   ├── safety.ts      # Safety checks
│   │   ├── colorConversion.ts # Color conversion utilities
│   │   ├── format.ts      # Color formatting
│   │   ├── dedupe.ts      # Deduplication logic
│   │   ├── sort.ts        # Sorting logic
│   │   └── analysis.ts    # Color analysis
│   └── __mocks__/         # Test mocks
│       └── vscode.ts      # VS Code API mock
├── docs/                  # Documentation
│   ├── ARCHITECTURE.md    # Architecture documentation
│   ├── SPECIFICATION.md   # Technical specification
│   ├── COMMANDS.md        # Command documentation
│   ├── CONFIGURATION.md   # Configuration documentation
│   ├── DEVELOPMENT.md     # Development guide
│   ├── PERFORMANCE.md     # Performance guide
│   ├── PRIVACY.md         # Privacy documentation
│   ├── TESTING.md         # Testing guide
│   └── TROUBLESHOOTING.md # Troubleshooting guide
├── test/                  # Test files
│   ├── fixtures/          # Test fixtures
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── performance/       # Performance tests
├── dist/                  # Compiled JavaScript
├── release/               # Packaged extensions
├── package.json           # Package configuration
├── tsconfig.json          # TypeScript configuration
├── biome.json             # Linting configuration
└── README.md              # Project documentation
```

## Code Style

### TypeScript Standards

- Use strict TypeScript configuration
- Prefer `readonly` types and `Object.freeze()` for immutability
- Use factory functions over classes
- Write pure functions with explicit return type annotations
- Enable `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`

### Functional Programming

- Prefer pure functions over impure ones
- Use immutable data structures
- Avoid side effects in utility functions
- Use dependency injection for testability

### Code Organization

- Keep `src/extension.ts` minimal - only register commands/providers
- Organize by feature: commands/, config/, ui/, utils/
- Separate core logic from VS Code API surface
- Use centralized type definitions in `types.ts`

### Error Handling

- Use centralized error handling patterns
- Categorize errors by type and severity
- Provide user-friendly error messages
- Include recovery options where possible

## Testing

### Test Structure

- Unit tests for pure functions
- Integration tests for command flow
- Performance tests for large datasets
- Mock VS Code API for isolated testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test src/utils/colorConversion.test.ts

# Run tests with coverage
npm run test:coverage

# Run performance tests
npm run test:performance
```

### Test Data

- Use realistic test data in `test/fixtures/`
- Include edge cases and error scenarios
- Test with various file sizes and formats
- Validate against expected outputs

### Mocking

- Mock VS Code API using `src/__mocks__/vscode.ts`
- Mock external dependencies
- Use dependency injection for testability
- Isolate components for unit testing

## Debugging

### VS Code Debugging

1. **Set breakpoints** in VS Code
2. **Press F5** to start debugging
3. **Open Extension Development Host**
4. **Test the extension** in the new window

### Debug Configuration

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "preLaunchTask": "npm: build"
    }
  ]
}
```

### Debugging Tips

- Use `console.log()` for quick debugging
- Check VS Code Output panel for logs
- Use telemetry for detailed logging
- Test with real files and scenarios

## Building and Packaging

### Development Build

```bash
# Build for development
npm run build

# Watch for changes
npm run watch
```

### Production Build

```bash
# Build for production
npm run build:prod

# Package extension
npm run package
```

### Build Configuration

- **TypeScript**: Strict mode enabled
- **Target**: ES2020 for modern JavaScript
- **Module**: CommonJS for VS Code compatibility
- **Source Maps**: Enabled for debugging

## Performance Optimization

### Memory Management

- Use immutable data structures
- Dispose of resources properly
- Monitor memory usage
- Implement cleanup routines

### Processing Optimization

- Use efficient algorithms
- Implement caching where appropriate
- Use streaming for large files
- Optimize regex patterns

### Safety Checks

- Implement file size limits
- Add processing time limits
- Monitor memory usage
- Provide user warnings

## Code Quality

### Linting

- Use Biome for linting and formatting
- Enable strict rules
- Fix all linting errors
- Use consistent formatting

### Type Safety

- Use strict TypeScript
- Avoid `any` types
- Use proper type guards
- Implement runtime validation

### Documentation

- Document all public APIs
- Use JSDoc comments
- Include examples
- Keep documentation up to date

## Contributing

### Development Workflow

1. **Create feature branch**:

   ```bash
   git checkout -b feature/new-feature
   ```

2. **Make changes**:

   - Write code following style guidelines
   - Add tests for new functionality
   - Update documentation

3. **Test changes**:

   ```bash
   npm test
   npm run build
   ```

4. **Commit changes**:

   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

5. **Push changes**:
   ```bash
   git push origin feature/new-feature
   ```

### Code Review

- Follow established patterns
- Ensure test coverage
- Update documentation
- Consider performance impact

### Pull Request Process

1. **Create pull request**
2. **Add description** of changes
3. **Link related issues**
4. **Request review**
5. **Address feedback**
6. **Merge when approved**

## Release Process

### Version Management

- Use semantic versioning (semver)
- Update version in `package.json`
- Update changelog
- Tag releases

### Release Steps

1. **Update version**:

   ```bash
   npm version patch|minor|major
   ```

2. **Build and test**:

   ```bash
   npm run build:prod
   npm test
   ```

3. **Package extension**:

   ```bash
   npm run package
   ```

4. **Create release**:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

## Troubleshooting

### Common Issues

1. **Build failures**: Check TypeScript errors
2. **Test failures**: Verify test data and mocks
3. **Performance issues**: Check memory usage and algorithms
4. **VS Code integration**: Verify API usage

### Debug Tools

- **VS Code Developer Tools**: For extension debugging
- **Performance Profiler**: For performance analysis
- **Memory Profiler**: For memory leak detection
- **Network Inspector**: For API calls (if any)

### Getting Help

- Check existing issues and discussions
- Create new issue with detailed description
- Include reproduction steps
- Provide system information

## Best Practices

### Code Quality

- Write clean, readable code
- Use meaningful variable names
- Implement proper error handling
- Follow established patterns

### Testing

- Write comprehensive tests
- Test edge cases and error scenarios
- Maintain high test coverage
- Use realistic test data

### Performance

- Optimize for common use cases
- Implement safety checks
- Monitor resource usage
- Provide user feedback

### Documentation

- Keep documentation current
- Include examples and use cases
- Document configuration options
- Provide troubleshooting guides
