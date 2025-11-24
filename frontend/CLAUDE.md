# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the frontend component of the Datahog project, an Angular 20 application that provides a user interface for the Datahog system. The frontend communicates with the backend API and uses a local WebAssembly npm package (`datahog-npm`) for core data operations.

## Development Commands

### Starting Development
```bash
npm start              # Start dev server (ng serve)
npm run build          # Production build
npm run watch          # Build in watch mode for development
npm test               # Run tests with Karma
```

### Angular CLI
```bash
npm run ng -- <command>  # Run any Angular CLI command
```

## Architecture

### Core Service Layer

**DataHogService** (`src/app/data-hog.ts`)
- Central service managing the WebAssembly `Datahog` instance
- Initializes WASM module from `../npm-wasm/pkg` directory
- Connects to backend API at `http://localhost:8000/api/v1`
- Provides async operations for nodes and edges (get, update)
- Uses RxJS `Subject` (`done`) to signal when WASM is initialized
- All components must wait for `done` observable before accessing data

### WebAssembly Integration

The app depends on a local WebAssembly package:
- Package: `datahog-npm` from `file:../npm-wasm/pkg`
- WASM files are copied to build via `angular.json` assets configuration
- The WASM module is loaded asynchronously via `fetch()` in DataHogService
- WASM types exported: `Datahog`, `Node`, `NodeID`, `Edge`, `EdgeID`

### Application Bootstrap

1. `main.ts` bootstraps the App component with `appConfig`
2. App component (`app.ts`) injects `DataHogService`
3. `ngOnInit()` waits for DataHogService initialization via `done` subscription
4. Once initialized, app fetches and displays the root node

### View Components

**Current Editor: EditorJS**
- Located in `src/app/view/node_md/`
- Uses `@editorjs/editorjs` with Header and List plugins
- Component: `nodemdComponent` (non-standard lowercase naming)
- Provides block-based markdown-like editing

**Historical Note:**
The codebase shows evidence of experimentation with multiple rich text editors:
- TipTap, Lexical, BlockNote, CodeMirror, TinyMCE, Novel
- Most are commented out or unused
- Only EditorJS is currently active

### Routing

- Router is configured but `app.routes.ts` currently has no routes defined
- App uses `RouterOutlet` but all content is currently in the root component

## Build Configuration

### Assets
- WASM files from `../npm-wasm/pkg` are bundled as assets
- Public directory contents are included in build

### Bundle Size Limits
- Initial: 500kB warning, 1MB error
- Component styles: 4kB warning, 8kB error

### Styling
- SCSS with Angular parser
- Prettier configured with 100 char line width, single quotes

## TypeScript Configuration

Strict mode enabled with:
- `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`
- Angular strict templates and injection parameters
- Experimental decorators for Angular

## Testing

Tests run with Karma + Jasmine:
- Test files follow `*.spec.ts` pattern
- Configuration: `tsconfig.spec.json`
- Run with: `npm test`

## Key Dependencies

**Runtime:**
- Angular 20.2 (latest)
- EditorJS for rich text editing
- RxJS for reactive patterns
- Local `datahog-npm` WebAssembly package

**Important:** The frontend depends on the `../npm-wasm` directory containing the built WASM package. If WASM-related errors occur, verify that directory exists and contains `pkg/` with WASM files.
