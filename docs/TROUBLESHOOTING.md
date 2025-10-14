# Colors-LE Troubleshooting Guide

This document provides solutions to common issues and problems encountered when using the Colors-LE VS Code extension.

## Common Issues

### No Colors Found

**Problem**: Extension reports "No colors found" when you expect colors to be extracted.

**Possible Causes**:

1. File type not supported
2. Color format not recognized
3. Colors in comments (if disabled)
4. Invalid color syntax

**Solutions**:

1. **Check File Type**:

   ```bash
   # Verify file extension is supported
   # Supported: .css, .scss, .js, .ts, .json, .yaml, .html
   ```

2. **Check Color Format**:

   ```css
   /* Supported formats */
   color: #ff0000; /* Hex */
   color: rgb(255, 0, 0); /* RGB */
   color: rgba(255, 0, 0, 0.5); /* RGBA */
   color: hsl(0, 100%, 50%); /* HSL */
   color: hsla(0, 100%, 50%, 0.5); /* HSLA */
   color: red; /* Named colors */
   ```

3. **Enable Comment Extraction**:

   ```json
   {
     "colors-le.extraction.includeComments": true
   }
   ```

4. **Check Color Syntax**:

   ```css
   /* Valid */
   color: #ff0000;
   color: rgb(255, 0, 0);

   /* Invalid */
   color: #gggggg;
   color: rgb(256, 0, 0);
   ```

### Parse Errors

**Problem**: Extension shows parse errors or warnings.

**Possible Causes**:

1. Malformed color values
2. Invalid CSS syntax
3. Unsupported color formats
4. File encoding issues

**Solutions**:

1. **Fix Color Values**:

   ```css
   /* Fix invalid hex colors */
   color: #ff0000; /* Instead of #gggggg */

   /* Fix RGB values */
   color: rgb(255, 0, 0); /* Instead of rgb(256, 0, 0) */

   /* Fix HSL values */
   color: hsl(0, 100%, 50%); /* Instead of hsl(0, 101%, 50%) */
   ```

2. **Check CSS Syntax**:

   ```css
   /* Valid CSS */
   .class {
     color: #ff0000;
   }

   /* Invalid CSS */
   .class {
     color: #ff0000; /* Missing semicolon */
   }
   ```

3. **Disable Parse Error Warnings**:
   ```json
   {
     "colors-le.showParseErrors": false
   }
   ```

### Performance Issues

**Problem**: Extension is slow or unresponsive.

**Possible Causes**:

1. Large file size
2. Many colors to process
3. Complex analysis operations
4. Memory limitations

**Solutions**:

1. **Check File Size**:

   ```bash
   # Check file size
   ls -lh your-file.css

   # If > 1MB, consider splitting the file
   ```

2. **Adjust Safety Limits**:

   ```json
   {
     "colors-le.safety.enabled": true,
     "colors-le.safety.fileSizeWarnBytes": 524288,
     "colors-le.safety.maxColorsThreshold": 5000,
     "colors-le.safety.processingTimeWarnMs": 2000
   }
   ```

3. **Disable Heavy Features**:

   ```json
   {
     "colors-le.analysis.includePaletteAnalysis": false,
     "colors-le.output.includeContext": false
   }
   ```

4. **Use Performance Mode**:
   ```json
   {
     "colors-le.notificationsLevel": "silent",
     "colors-le.showParseErrors": false,
     "colors-le.telemetryEnabled": false
   }
   ```

### Memory Issues

**Problem**: Extension consumes too much memory or crashes.

**Possible Causes**:

1. Large color datasets
2. Memory leaks
3. Inefficient algorithms
4. System limitations

**Solutions**:

1. **Monitor Memory Usage**:

   ```bash
   # Check VS Code memory usage
   # VS Code > Help > Toggle Developer Tools > Memory tab
   ```

2. **Reduce Color Count**:

   ```json
   {
     "colors-le.safety.maxColorsThreshold": 1000
   }
   ```

3. **Restart VS Code**:

   ```bash
   # Close VS Code completely
   # Reopen VS Code
   # Reload the extension
   ```

4. **Check System Resources**:
   ```bash
   # Check available memory
   free -h  # Linux
   vm_stat  # macOS
   ```

### Configuration Issues

**Problem**: Settings not applied or extension behaves unexpectedly.

**Possible Causes**:

1. Invalid configuration values
2. Conflicting settings
3. Extension not reloaded
4. VS Code settings corruption

**Solutions**:

1. **Check Configuration**:

   ```json
   {
     "colors-le.extraction.includeComments": true,
     "colors-le.extraction.includeNamedColors": true,
     "colors-le.extraction.includeTransparent": false,
     "colors-le.analysis.wcagLevel": "AA",
     "colors-le.analysis.contrastThreshold": 4.5,
     "colors-le.output.format": "hex",
     "colors-le.safety.enabled": true
   }
   ```

2. **Reset Configuration**:

   ```bash
   # Reset to defaults
   # VS Code > Settings > Search "colors-le" > Reset Setting
   ```

3. **Reload Extension**:

   ```bash
   # Command Palette > "Developer: Reload Window"
   ```

4. **Check VS Code Settings**:
   ```bash
   # Verify VS Code settings.json is valid JSON
   # Check for syntax errors
   ```

## Debugging

### Enable Debug Logging

1. **Enable Telemetry**:

   ```json
   {
     "colors-le.telemetryEnabled": true
   }
   ```

2. **Check Output Panel**:

   ```bash
   # VS Code > View > Output
   # Select "Colors-LE" from dropdown
   ```

3. **Enable Verbose Logging**:
   ```json
   {
     "colors-le.notificationsLevel": "all"
   }
   ```

### Debug Information

1. **Extension Version**:

   ```bash
   # Command Palette > "Extensions: Show Installed Extensions"
   # Find "Colors-LE" and check version
   ```

2. **VS Code Version**:

   ```bash
   # Help > About
   # Check VS Code version
   ```

3. **System Information**:
   ```bash
   # Command Palette > "Developer: Toggle Developer Tools"
   # Check Console for errors
   ```

### Common Debug Scenarios

1. **Extension Not Activating**:

   - Check VS Code version compatibility
   - Verify extension installation
   - Check for conflicting extensions
   - Review VS Code logs

2. **Commands Not Working**:

   - Verify command registration
   - Check keyboard shortcuts
   - Test via Command Palette
   - Review extension activation

3. **Colors Not Extracted**:
   - Check file type support
   - Verify color format recognition
   - Test with simple examples
   - Review extraction logs

## Error Messages

### Common Error Messages

1. **"No active editor"**:

   - Open a file in VS Code
   - Ensure file is supported format
   - Check file permissions

2. **"File too large"**:

   - Reduce file size
   - Adjust safety limits
   - Split large files

3. **"Invalid color format"**:

   - Check color syntax
   - Verify color values
   - Use supported formats

4. **"Memory limit exceeded"**:
   - Reduce color count
   - Restart VS Code
   - Check system resources

### Error Recovery

1. **Graceful Degradation**:

   - Extension continues with warnings
   - Partial results provided
   - User can retry operation

2. **Error Reporting**:

   - Errors logged to Output panel
   - User notified of issues
   - Recovery options provided

3. **Fallback Behavior**:
   - Safe defaults used
   - Operation continues when possible
   - User can adjust settings

## Performance Optimization

### File Processing

1. **Optimize File Size**:

   ```bash
   # Split large files
   # Remove unnecessary content
   # Compress CSS/JS files
   ```

2. **Optimize Color Count**:

   ```bash
   # Remove duplicate colors
   # Use color variables
   # Consolidate color definitions
   ```

3. **Optimize Processing**:
   ```json
   {
     "colors-le.safety.enabled": true,
     "colors-le.performance.batchSize": 1000,
     "colors-le.performance.cacheSize": 1000
   }
   ```

### Memory Optimization

1. **Reduce Memory Usage**:

   ```json
   {
     "colors-le.safety.maxColorsThreshold": 5000,
     "colors-le.performance.batchSize": 500
   }
   ```

2. **Enable Cleanup**:

   ```bash
   # Extension automatically cleans up
   # Restart VS Code if needed
   # Monitor memory usage
   ```

3. **Optimize Settings**:
   ```json
   {
     "colors-le.output.includeContext": false,
     "colors-le.output.includePosition": false
   }
   ```

## Getting Help

### Self-Help Resources

1. **Documentation**:

   - Read this troubleshooting guide
   - Check COMMANDS.md for usage
   - Review CONFIGURATION.md for settings

2. **Examples**:

   - Test with provided examples
   - Use sample files
   - Try different configurations

3. **Community**:
   - VS Code community forums
   - GitHub issues and discussions
   - Stack Overflow questions

### Reporting Issues

1. **Before Reporting**:

   - Check existing issues
   - Try latest version
   - Test with minimal example
   - Gather debug information

2. **Issue Information**:

   - VS Code version
   - Extension version
   - Operating system
   - Steps to reproduce
   - Expected vs actual behavior
   - Debug logs and screenshots

3. **GitHub Issues**:
   - Create detailed issue
   - Include reproduction steps
   - Attach relevant files
   - Label appropriately

### Support Channels

1. **GitHub Issues**: Primary support channel
2. **VS Code Community**: General VS Code help
3. **Stack Overflow**: Technical questions
4. **Documentation**: Self-service help

## Best Practices

### Prevention

1. **Regular Updates**:

   - Keep VS Code updated
   - Update extension regularly
   - Check for known issues

2. **Backup Configuration**:

   - Export VS Code settings
   - Backup workspace settings
   - Document custom configurations

3. **Monitor Performance**:
   - Check memory usage
   - Monitor processing time
   - Review error logs

### Maintenance

1. **Regular Cleanup**:

   - Clear VS Code logs
   - Restart VS Code periodically
   - Check for memory leaks

2. **Configuration Review**:

   - Review settings periodically
   - Optimize for your use case
   - Remove unused configurations

3. **Testing**:
   - Test with different file types
   - Verify functionality after updates
   - Check performance regularly

## Advanced Troubleshooting

### VS Code Integration

1. **Extension Host Issues**:

   ```bash
   # Command Palette > "Developer: Toggle Developer Tools"
   # Check Console for errors
   # Restart Extension Host if needed
   ```

2. **Command Registration**:

   ```bash
   # Command Palette > "Developer: Reload Window"
   # Check command availability
   # Verify keyboard shortcuts
   ```

3. **Settings Integration**:
   ```bash
   # Check settings.json syntax
   # Verify configuration values
   # Test settings changes
   ```

### System-Level Issues

1. **File System**:

   ```bash
   # Check file permissions
   # Verify file encoding
   # Test with different file types
   ```

2. **Memory Management**:

   ```bash
   # Monitor system memory
   # Check VS Code memory usage
   # Restart if needed
   ```

3. **Performance**:
   ```bash
   # Check CPU usage
   # Monitor disk I/O
   # Optimize system performance
   ```

### Extension-Specific Issues

1. **Color Extraction**:

   - Test with known good files
   - Verify regex patterns
   - Check format support

2. **Color Analysis**:

   - Test with simple colors
   - Verify calculation accuracy
   - Check analysis results

3. **Output Generation**:
   - Test output formats
   - Verify file creation
   - Check content accuracy
