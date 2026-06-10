# MindCanvas

MindCanvas is a Google Apps Script web app for organizing ideas on an infinite canvas.
It combines two ways of thinking in one personal workspace:

- **Tree mode** for structured, right-expanding mind maps
- **Freeform mode** for loose brainstorming, diagrams, and visual notes

Projects are saved immediately to `localStorage` and can be backed up through Google
Drive or a bound Google Spreadsheet, depending on the deployment environment.

## Features

- Multiple projects and sheets
- Tree and freeform canvas modes
- Markdown-enabled nodes with memo fields
- Drag-to-connect edges with labels
- Zoom, pan, grid, snap, minimap, and fit-to-view
- Selection, alignment, distribution, grouping, sections, undo/redo
- Cross-sheet search
- Export to PNG, PDF, Markdown, and Mermaid
- Durable storage fallback: Drive first, bound Spreadsheet when Drive is unavailable

## Tech Stack

- Google Apps Script
- Vanilla HTML/CSS/JavaScript
- SVG for edges and branches
- DOM-based nodes for rich text editing
- `marked`, `DOMPurify`, `html-to-image`, and `jsPDF` from CDN

## Repository Structure

```text
src/                 GAS source files pushed by clasp
docs/                Product, architecture, data model, and development docs
build_local.js       Local preview builder for browser testing
```

Apps Script serves a single HTML file, so `src/index.html` includes the CSS and JS
partials from `src/` with GAS scriptlets.

## Local Preview

Build the standalone preview file:

```bash
node build_local.js
```

Then serve the repository root and open `local_preview.html`:

```bash
python3 -m http.server 8765
```

```text
http://localhost:8765/local_preview.html
```

Add `?backend=sheet` to the URL to test the Spreadsheet fallback path in the local
stubbed environment.

## Deploying to Google Apps Script

This repository intentionally does not include `.clasp.json`. Create your own Apps
Script project and keep the generated script ID local.

For a spreadsheet-bound deployment:

```bash
clasp create --type sheets --title "MindCanvas"
```

Create `.clasp.json` in the repository root:

```json
{
  "scriptId": "YOUR_SCRIPT_ID",
  "rootDir": "src"
}
```

Then push and deploy:

```bash
clasp push -f
clasp deploy --description "MindCanvas"
```

See [docs/development.md](docs/development.md) for more detailed setup notes.

## Google OAuth Scopes

The default manifest requests:

- `https://www.googleapis.com/auth/drive.file`
- `https://www.googleapis.com/auth/spreadsheets.currentonly`

`drive.file` lets the app create and manage only files it creates in Drive.
`spreadsheets.currentonly` is used for the spreadsheet-bound fallback store.

If Drive access is not available in your environment, remove the `drive.file` scope
from `src/appsscript.json`; MindCanvas will fall back to the bound Spreadsheet path
when deployed that way.

## Documentation

- [Requirements](docs/requirements.md)
- [Architecture](docs/architecture.md)
- [Data model](docs/data-model.md)
- [UI and shortcuts](docs/ui-and-shortcuts.md)
- [Module API](docs/modules-api.md)
- [Storage and sync](docs/storage-and-sync.md)
- [Export](docs/export.md)
- [Development](docs/development.md)

## License

MIT
