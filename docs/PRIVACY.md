# Colors-LE Privacy Policy

This document describes the privacy practices and data handling policies for the Colors-LE VS Code extension.

## Privacy Overview

Colors-LE is designed with privacy-first principles. All processing happens locally on your machine, and no data is transmitted to external servers or third parties.

## Data Collection

### What We Collect

Colors-LE does **NOT** collect any personal data, file contents, or sensitive information. The extension operates entirely locally.

### What We Don't Collect

- **File Contents**: No file content is ever transmitted
- **Color Data**: No extracted colors are sent anywhere
- **User Input**: No user commands or interactions are logged externally
- **Personal Information**: No personal data is collected
- **Usage Patterns**: No usage analytics are collected
- **Error Details**: No error details are transmitted

### Local-Only Operations

All Colors-LE operations happen locally:

- **Color Extraction**: Processed entirely on your machine
- **Color Analysis**: All calculations performed locally
- **File Processing**: No files are uploaded or transmitted
- **Configuration**: All settings stored locally in VS Code
- **Logging**: All logs remain on your machine

## Telemetry and Logging

### Local Telemetry (Optional)

Colors-LE includes an optional local-only telemetry system:

```json
{
  "colors-le.telemetryEnabled": false
}
```

When enabled, telemetry logs are written to the VS Code Output panel only. No data is transmitted externally.

### What Local Telemetry Collects

If enabled, local telemetry may collect:

- **Command Usage**: Which commands are executed (no file details)
- **Performance Metrics**: Processing times and memory usage
- **Error Counts**: Number of errors encountered (no error details)
- **Configuration Changes**: Settings modifications
- **Extension Lifecycle**: Activation and deactivation events

### What Local Telemetry Doesn't Collect

- **File Names**: No file names or paths are logged
- **File Contents**: No file content is logged
- **Color Values**: No actual color values are logged
- **User Identifiers**: No user identification information
- **Network Data**: No network requests are made

### Disabling Telemetry

You can disable telemetry at any time:

1. **VS Code Settings**: Set `colors-le.telemetryEnabled` to `false`
2. **Settings JSON**: Add the setting to your `settings.json`
3. **Command Palette**: Use "Colors-LE: Open Settings" command

## Data Storage

### Local Storage Only

All Colors-LE data is stored locally:

- **Configuration**: Stored in VS Code settings
- **Logs**: Stored in VS Code Output panel
- **Cache**: Stored in VS Code extension storage
- **Temporary Data**: Stored in memory only

### No External Storage

Colors-LE does not use:

- **Cloud Storage**: No data stored in the cloud
- **External Databases**: No external database connections
- **Third-Party Services**: No third-party integrations
- **Analytics Services**: No analytics platforms

## Network Access

### No Network Requests

Colors-LE makes no network requests:

- **No HTTP Requests**: No web API calls
- **No WebSocket Connections**: No real-time connections
- **No External Dependencies**: No external service dependencies
- **No Update Checks**: No automatic update checking

### Offline Operation

Colors-LE works completely offline:

- **No Internet Required**: All functionality works offline
- **No External Dependencies**: No external service requirements
- **No Network Fallbacks**: No network-based fallback mechanisms
- **No Online Features**: No online-only features

## Security Considerations

### Input Validation

Colors-LE validates all inputs locally:

- **File Type Validation**: Validates file types and extensions
- **Content Validation**: Validates file content and structure
- **Color Format Validation**: Validates color format and range
- **Path Validation**: Validates file paths and prevents traversal

### Data Sanitization

All data is sanitized locally:

- **Error Messages**: Sensitive information removed from errors
- **Log Entries**: No sensitive data included in logs
- **User Feedback**: No sensitive information in user messages
- **Debug Output**: No sensitive data in debug output

### Workspace Trust

Colors-LE respects VS Code workspace trust:

- **Trusted Workspaces**: Full functionality in trusted workspaces
- **Untrusted Workspaces**: Limited functionality in untrusted workspaces
- **Virtual Workspaces**: Appropriate limitations in virtual workspaces
- **Remote Workspaces**: Compatible with remote development

## Compliance

### GDPR Compliance

Colors-LE is GDPR compliant:

- **No Personal Data**: No personal data is collected
- **No Data Processing**: No data processing occurs
- **No Data Transmission**: No data is transmitted
- **No Data Retention**: No data is retained externally
- **User Control**: Users have full control over local data

### CCPA Compliance

Colors-LE is CCPA compliant:

- **No Data Sale**: No data is sold or shared
- **No Data Collection**: No personal information is collected
- **No Data Disclosure**: No data is disclosed to third parties
- **User Rights**: Users have full control over their data

### HIPAA Considerations

Colors-LE is suitable for HIPAA environments:

- **Local Processing**: All processing happens locally
- **No Data Transmission**: No data leaves the local machine
- **No External Dependencies**: No external service dependencies
- **No Data Retention**: No external data retention

## User Rights

### Data Control

Users have complete control over their data:

- **Local Storage**: All data stored locally
- **Configuration Control**: Full control over settings
- **Telemetry Control**: Can enable/disable telemetry
- **Log Control**: Can clear logs at any time
- **Extension Control**: Can uninstall extension completely

### Data Deletion

Users can delete all Colors-LE data:

1. **Clear Logs**: Clear VS Code Output panel
2. **Reset Settings**: Reset all configuration to defaults
3. **Clear Cache**: Clear extension storage
4. **Uninstall Extension**: Remove extension completely

### Data Portability

Users can export their configuration:

- **Settings Export**: Export VS Code settings
- **Configuration Backup**: Backup configuration files
- **Log Export**: Export logs if needed
- **No Data Lock-in**: No proprietary data formats

## Third-Party Dependencies

### Minimal Dependencies

Colors-LE has minimal dependencies:

- **VS Code API**: Uses VS Code's built-in APIs
- **TypeScript**: Uses TypeScript for development
- **Node.js**: Uses Node.js runtime (provided by VS Code)
- **No External Libraries**: No external npm packages

### Dependency Privacy

All dependencies are privacy-focused:

- **VS Code**: Microsoft's privacy policy applies
- **TypeScript**: Microsoft's privacy policy applies
- **Node.js**: Open source, no privacy concerns
- **No Third-Party Services**: No external service dependencies

## Updates and Changes

### Privacy Policy Updates

This privacy policy may be updated:

- **Version Changes**: Updated with extension versions
- **Feature Changes**: Updated when features change
- **Compliance Changes**: Updated for compliance requirements
- **User Notification**: Users notified of significant changes

### Change History

- **v1.0.0**: Initial privacy policy
- **Future Versions**: Will be documented here

## Contact Information

### Privacy Questions

For privacy-related questions:

- **GitHub Issues**: Create an issue on the GitHub repository
- **Documentation**: Check this documentation first
- **VS Code Community**: Ask in VS Code community forums
- **No Direct Contact**: No direct contact information provided

### Privacy Concerns

If you have privacy concerns:

1. **Review This Policy**: Read this privacy policy carefully
2. **Check Settings**: Verify your configuration settings
3. **Disable Features**: Disable any features you're concerned about
4. **Report Issues**: Report any privacy issues you discover

## Best Practices

### Privacy Recommendations

For maximum privacy:

1. **Disable Telemetry**: Set `colors-le.telemetryEnabled` to `false`
2. **Review Settings**: Check all configuration options
3. **Clear Logs**: Regularly clear VS Code Output panel
4. **Update Regularly**: Keep the extension updated
5. **Report Issues**: Report any privacy concerns

### Security Recommendations

For maximum security:

1. **Use Trusted Workspaces**: Only use in trusted workspaces
2. **Validate Inputs**: Be cautious with file inputs
3. **Monitor Logs**: Regularly check logs for issues
4. **Keep Updated**: Keep VS Code and extensions updated
5. **Use Antivirus**: Use antivirus software

## Conclusion

Colors-LE is designed with privacy and security as top priorities. The extension operates entirely locally, collects no personal data, and makes no network requests. Users have complete control over their data and can disable any features they're concerned about.

This privacy policy reflects our commitment to protecting user privacy and maintaining transparency about our data practices.
