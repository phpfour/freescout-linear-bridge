# FreeScout to Linear Bridge

A Chrome Extension that seamlessly creates Linear issues from FreeScout support tickets. Built with Manifest V3 standards.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Manifest](https://img.shields.io/badge/manifest-v3-green)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- **One-Click Issue Creation**: Convert FreeScout tickets to Linear issues with a single click
- **Smart Data Extraction**: Automatically extracts ticket subject, body, customer info, and conversation thread
- **Team/Project Selection**: Choose which Linear team and project to create issues in
- **Label Support**: Apply labels to newly created issues
- **Priority Mapping**: Maps FreeScout priorities to Linear priority levels
- **Context Menu Integration**: Right-click to create issues from anywhere on the page
- **Configurable Defaults**: Set default team, project, and labels for quick issue creation

## Screenshot

#### Issue Creation
<img width="3360" height="1876" alt="CleanShot 2025-12-18 at 08 22 39@2x" src="https://github.com/user-attachments/assets/2bcc0500-e432-484f-abe6-0d4d7cf953a9" />

#### Linear Issue
<img width="3360" height="2100" alt="CleanShot 2025-12-18 at 08 24 59@2x" src="https://github.com/user-attachments/assets/a3b83243-316c-4d0b-8e2c-4390cc37f83b" />


## Installation

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked"
5. Select the `freescout-linear-bridge` directory

### Configuration

1. Click the extension icon in Chrome toolbar
2. Click "Settings" or navigate to `chrome://extensions/` → FreeScout to Linear → Details → Extension options
3. Enter your Linear API key
4. Click "Test Connection" to verify
5. Select default team, project, and labels (optional)

## Getting Your Linear API Key

1. Go to [Linear Settings → API](https://linear.app/settings/api)
2. Click "Create key"
3. Give it a name (e.g., "FreeScout Bridge")
4. Copy the generated key (starts with `lin_api_`)
5. Paste it in the extension settings

## Usage

### Method 1: Extension Popup

1. Navigate to a FreeScout ticket
2. Click the extension icon in the toolbar
3. Click "Create Linear Issue"
4. Review/edit the extracted data
5. Select team, project, and labels
6. Click "Create Issue"

### Method 2: Page Button

When on a FreeScout ticket page, a "Create Linear Issue" button appears in the action bar or as a floating button.

### Method 3: Context Menu

Right-click anywhere on a FreeScout ticket page and select "Create Linear Issue from Ticket"

## How It Works

### Data Extraction

The extension extracts the following data from FreeScout:

| FreeScout Field | Linear Field | Notes |
|-----------------|--------------|-------|
| Subject | Issue Title | Editable before creation |
| First Message Body | Issue Description | Markdown formatted |
| Customer Name/Email | Description metadata | Included in description |
| Ticket ID | Description metadata | With link back to FreeScout |
| Conversation Thread | Description section | All messages included |
| Priority | Issue Priority | Mapped to Linear scale |

### Priority Mapping

| FreeScout | Linear |
|-----------|--------|
| Urgent | 🔴 Urgent (1) |
| High | 🟠 High (2) |
| Medium/Normal | 🟡 Medium (3) |
| Low | 🟢 Low (4) |
| None | No priority (0) |

## Customizing DOM Selectors

If your FreeScout installation uses custom themes or has modified DOM structure, you may need to update the selectors in `content/content.js`:

```javascript
const CONFIG = {
  selectors: {
    ticketSubject: '.conv-subj, .custom-subject-class',
    ticketId: '.conv-num, .custom-id-class',
    // ... add your custom selectors
  }
};
```

## File Structure

```
freescout-linear-bridge/
├── manifest.json           # Extension manifest (MV3)
├── background/
│   └── service-worker.js   # Background service worker
├── content/
│   ├── content.js          # Content script for FreeScout pages
│   └── content.css         # Styles for injected UI
├── popup/
│   ├── popup.html          # Extension popup UI
│   ├── popup.css           # Popup styles
│   └── popup.js            # Popup logic
├── options/
│   ├── options.html        # Settings page
│   ├── options.css         # Settings styles
│   └── options.js          # Settings logic
└── icons/
    ├── icon.svg            # Source icon
    ├── icon16.png          # 16x16 icon
    ├── icon32.png          # 32x32 icon
    ├── icon48.png          # 48x48 icon
    └── icon128.png         # 128x128 icon
```

## API Reference

### Linear GraphQL API

The extension uses Linear's GraphQL API for:

- **Teams Query**: Fetch available teams
- **Projects Query**: Fetch team projects
- **Labels Query**: Fetch team labels
- **IssueCreate Mutation**: Create new issues

### Required Permissions

| Permission | Purpose |
|------------|---------|
| `storage` | Store API keys and settings |
| `activeTab` | Access current tab for data extraction |
| `contextMenus` | Add right-click menu option |
| `notifications` | Show success/error notifications |

### Host Permissions

| Domain | Purpose |
|--------|---------|
| `https://api.linear.app/*` | Linear API calls |
| `*://*/*` | Access FreeScout on any domain |

## Troubleshooting

### "Could not extract ticket data"

- Ensure you're on a FreeScout ticket page (not the mailbox list)
- Check if your FreeScout theme uses custom CSS classes
- Update selectors in `content/content.js` if needed

### "Linear API error"

- Verify your API key is correct
- Check if the API key has write permissions
- Ensure you have access to the selected team/project

### Button not appearing

- Refresh the FreeScout page
- Check browser console for errors
- Verify the extension is enabled

### Extension not detecting FreeScout

- Add your FreeScout domain to the manifest's `host_permissions`
- Or configure your domain in extension settings

## Development

### Building from Source

No build step required - the extension runs directly from source files.

### Testing

1. Load the extension in developer mode
2. Open Chrome DevTools on a FreeScout page
3. Check the Console for `[FreeScout-Linear]` logs

### Debugging

- **Background Service Worker**: `chrome://extensions/` → FreeScout to Linear → Service Worker
- **Content Script**: DevTools Console on FreeScout pages
- **Popup**: Right-click popup → Inspect

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- [Linear API Documentation](https://developers.linear.app/docs)
- [FreeScout Documentation](https://freescout.net/docs/)
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)

## Changelog

### v1.0.0

- Initial release
- Support for FreeScout ticket extraction
- Linear issue creation with team/project/label selection
- Context menu integration
- Configurable defaults
