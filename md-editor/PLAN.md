# Markdown Editor Architecture Plan

## Overview

A block-based markdown editor with mixed display mode (Obsidian-style): markdown source is edited and stored, but displayed as HTML. Markdown syntax becomes visible only when the cursor is active in that element.

**Architecture**: Framework-agnostic vanilla TypeScript library (similar to EditorJS) that can be used with any framework including Angular, React, Vue, or plain JavaScript. Uses RxJS for state management and vanilla DOM manipulation for rendering.

**Distribution**: Standalone npm package (`@datahog/md-editor`) located in `/md-editor` directory at the project root. Can be installed as a dependency in the frontend or any other project.

## Core Data Structure

### Block Tree
Blocks form a hierarchical tree structure where each block has:
- **child**: Optional nested block (for content under headings, or list items containing sublists)
- **next**: Optional sibling block (next block at same level)
- **content**: Text content with inline formatting
- **type**: Block type identifier (heading, list, etc.)
- **metadata**: Type-specific data (heading level, list style, etc.)

**Hierarchical Structure Philosophy:**
Headings semantically "own" their content. A heading's `child` contains the content under that heading, while `next` points to the next heading or block at the same level. This enables natural section folding/unfolding and easier section manipulation. Heading levels are still stored in metadata, not derived from tree depth.

```
Example structure:
Block(paragraph, "Intro text")
  -> next: Block(h1, "Title")
    -> child: Block(paragraph, "Content under h1")
      -> next: Block(paragraph, "More content")
        -> next: Block(h2, "Subtitle")
          -> child: Block(paragraph, "Content under h2")
    -> next: Block(h1, "Next Section")
      -> child: Block(ul, "Item 1")
        -> child: Block(ul, "Nested item")
        -> next: Block(ul, "Item 2")
```

## Character Flow Architecture

### Input Flow
1. **KeyDown/Input Event** → captured by editor container
2. **Event Handler** → determines cursor position and active block
3. **Auto-completion Check** → check if typed character triggers any inline plugin auto-completion
   - If match found, insert `before` + typed character + `after`, position cursor accordingly
   - Example: typing "*" triggers bold completion → inserts "**|*"
   - Example: typing "[" triggers link completion → inserts "[|]()"
4. **Block Plugin Handler** → processes the input based on block type
   - May create new blocks (Enter key)
   - May convert block types (typing "# " at start)
   - May modify content
5. **Inline Parser** → processes content for inline formatting
6. **Renderer** → updates DOM with mixed display mode

### Selection & Cursor Flow
1. **Browser Selection API** → track cursor position
2. **Position Mapper** → converts DOM position to block/offset
3. **Block Navigator** → handles cursor movement between blocks
   - Follows `child` link first if available when moving forward/down
   - Falls back to nearest `next` link if no child exists
   - Enables seamless navigation through hierarchical structure
4. **Inline Navigator** → handles cursor within inline elements

### Rendering Flow
1. **Block Tree** → iterate through linked blocks
2. **For each block**:
   - Check if cursor is active in block
   - If active: render with markdown syntax visible
   - If inactive: render as pure HTML
3. **Inline Rendering**:
   - Parse inline content using inline plugin matchers
   - If cursor touches inline element: show markdown syntax
   - If cursor outside: show formatted HTML

## Plugin Architecture

### Block Plugin API

```typescript
interface BlockPlugin {
  // Unique identifier for this block type
  id: string;

  // Display name for UI
  name: string;

  // Detect if text should convert to this block type
  // e.g., "# " at start → heading block
  matcher?: (text: string, position: number) => BlockMatchResult | null;

  // Parse markdown text into block structure
  parse(markdown: string): BlockData;

  // Serialize block to markdown
  serialize(block: Block): string;

  // Render block in inactive state (pure HTML)
  renderInactive(block: Block): HTMLElement;

  // Render block in active state (with markdown syntax visible)
  renderActive(block: Block, cursorOffset: number): HTMLElement;

  // Handle keyboard input within this block
  onKeyDown?(event: KeyboardEvent, block: Block, cursor: CursorPosition): BlockAction;

  // Handle block-level operations
  onCreate?(block: Block): void;
  onDestroy?(block: Block): void;
  onSplit?(block: Block, offset: number): [Block, Block]; // Enter key
  onMerge?(block: Block, nextBlock: Block): Block; // Backspace at end

  // Metadata operations
  getMetadata?(block: Block): Record<string, any>;
  setMetadata?(block: Block, metadata: Record<string, any>): void;
}

interface BlockMatchResult {
  type: string; // Block type to convert to
  consumeChars: number; // How many chars to remove (e.g., 2 for "# ")
  metadata?: Record<string, any>; // Initial metadata
}

interface BlockAction {
  type: 'continue' | 'stop' | 'create' | 'convert' | 'delete';
  newBlock?: Block;
  insertAs?: 'child' | 'next'; // Where to insert new block (default: 'next')
  convertTo?: string;
  preventDefault?: boolean;
}
```

### Inline Plugin API

```typescript
interface InlinePlugin {
  // Unique identifier
  id: string;

  // Display name
  name: string;

  // Group membership (e.g., 'basic-formatting', 'links')
  groups: string[];

  // Priority for overlapping matches (higher = first)
  priority: number;

  // Match inline syntax in text
  // Returns ranges that should be formatted
  match(text: string): InlineMatch[];

  // Parse markdown syntax to data structure
  parse(markdown: string, match: InlineMatch): InlineData;

  // Serialize back to markdown
  serialize(data: InlineData): string;

  // Render in inactive state (cursor not touching)
  renderInactive(data: InlineData): HTMLElement | string;

  // Render in active state (cursor touching)
  renderActive(data: InlineData, cursorOffset: number): HTMLElement | string;

  // Handle keyboard shortcuts (e.g., Ctrl+B for bold)
  shortcut?: string;

  // Can this inline wrap selected text?
  canWrapSelection?: boolean;

  // Wrap selected text with this inline format
  wrapSelection?(selectedText: string): string;

  // Auto-completion patterns for comfortable typing
  // When trigger character is typed, insert before/after cursor
  autoComplete?: Array<{
    trigger: string;    // Character that triggers (e.g., "*" or "[")
    before: string;     // Text to insert before cursor (e.g., "*")
    after: string;      // Text to insert after cursor (e.g., "*")
  }>;
}

interface InlineMatch {
  start: number; // Start position in text
  end: number; // End position in text
  type: string; // Inline type
  raw: string; // Raw markdown text
}

interface InlineData {
  type: string;
  content: string; // Inner content
  metadata?: Record<string, any>; // Type-specific data (e.g., URL for links)
}
```

### Editor Instantiation

The editor is instantiated similar to EditorJS, taking a configuration object:

```typescript
interface EditorConfig {
  // Required: DOM element to mount the editor
  holder: string | HTMLElement;

  // Block and inline plugins with configuration
  tools: {
    blocks?: Record<string, BlockPluginConfig>;
    inlines?: Record<string, InlinePlugin>;

    // Define inline groups
    inlineGroups?: Record<string, string[]>; // group name -> plugin ids
  };

  // Initial editor data (markdown string or block tree)
  data?: string | {
    blocks: BlockData[];
  };

  // Optional configuration
  autofocus?: boolean;
  placeholder?: string;
  readOnly?: boolean;
  minHeight?: number;

  // Callbacks
  onChange?: (api: EditorAPI, event: ChangeEvent) => void;
  onReady?: () => void;
}

// Block plugin configuration allows attaching inline groups
interface BlockPluginConfig {
  plugin: BlockPlugin;
  inlineGroups?: string[]; // Which inline groups this block supports
}

// Example instantiation
const editor = new MarkdownEditor({
  holder: 'editor-container',
  tools: {
    blocks: {
      paragraph: {
        plugin: ParagraphBlock,
        inlineGroups: ['basic-formatting', 'links']
      },
      heading: {
        plugin: HeadingBlock,
        inlineGroups: ['basic-formatting', 'links']
      },
      list: {
        plugin: UnorderedListBlock,
        inlineGroups: ['basic-formatting', 'links']
      },
      checkbox: {
        plugin: CheckboxBlock,
        inlineGroups: ['basic-formatting']
      }
    },
    inlines: {
      bold: BoldInline,
      italic: ItalicInline,
      link: MarkdownLinkInline,
      nodeLink: NodeLinkInline
    },
    inlineGroups: {
      'basic-formatting': ['bold', 'italic'],
      'links': ['link', 'nodeLink']
    }
  },
  data: '# My Document\n\nThis is **bold** text.',
  autofocus: true,
  onChange: (api, event) => {
    console.log('Content changed:', event);
  }
});

// Editor API methods
interface EditorAPI {
  // Save editor content as markdown string
  save(): Promise<string>;

  // Load markdown into editor
  load(markdown: string): Promise<void>;

  // Get current block tree (for advanced use)
  getBlocks(): Block[];

  // Clear editor content
  clear(): void;

  // Destroy editor instance
  destroy(): void;

  // Focus editor
  focus(): void;

  // Check if editor is empty
  isEmpty(): boolean;
}
```

## Core Components

All components are vanilla TypeScript classes with no framework dependencies.

### 1. MarkdownEditor (EditorCore)
- Main entry point (instantiated via `new MarkdownEditor(config)`)
- Manages block tree structure
- Handles cursor position tracking
- Coordinates between plugins from config.tools
- Exposes public API (save, load, destroy, etc.)

### 2. StateManager
- Manages editor state using RxJS Subjects
- Provides observable streams: `state$`, `cursor$`, `content$`, `selection$`
- Handles undo/redo history
- Emits change events for callbacks

### 3. BlockRenderer
- Renders block tree to DOM using vanilla JavaScript
- Manages active/inactive state transitions
- Handles contenteditable setup
- Syncs DOM changes back to block tree
- Creates/updates/removes DOM nodes efficiently

### 4. InlineParser
- Parses text content for inline formats
- Resolves overlapping inline elements
- Manages inline plugin priority
- Returns structured inline data for rendering

### 5. CursorManager
- Tracks cursor position in block tree
- Converts between DOM position and logical position
- Handles cursor movement commands (arrows, home, end)
- Manages selection state
- Uses browser Selection API

### 6. InputHandler
- Captures keyboard events
- Checks auto-completion triggers from inline plugins
- Routes to appropriate block plugin
- Handles inline formatting shortcuts (Ctrl+B, etc.)
- Manages composition events (for IME input)

### 7. MarkdownSerializer
- Converts block tree to markdown string
- Handles nested hierarchical structures
- Preserves metadata as needed
- Returns clean markdown text

### 8. MarkdownParser
- Converts markdown string to block tree
- Uses block plugin parsers
- Builds hierarchical tree structure
- Handles edge cases and malformed input

## Mixed Display Mode Implementation

### Block-Level
- Each block maintains `isActive` state based on cursor position
- When active: render with `renderActive()` showing markdown syntax
- When inactive: render with `renderInactive()` showing pure HTML
- Transition happens on cursor enter/leave

### Inline-Level
- Parse text to identify inline elements
- For each inline element, check if cursor is within its range
- If cursor within: render with `renderActive()` showing markdown syntax AND content in the chosen format (e.g., `**bold**` appears as bold text including the asterisks)
- If cursor outside: render with `renderInactive()` showing formatted HTML without syntax (e.g., `<strong>bold</strong>`)
- Use fine-grained cursor position tracking

### Cursor Position Tracking
- On every cursor move: calculate exact position in block tree
- Determine active block and offset within content
- Check which inline elements cursor touches
- Trigger re-render only for affected blocks/inlines

## Example Block Plugins

### HeadingBlock
```typescript
{
  id: 'heading',
  name: 'Heading',
  matcher: (text) => {
    const match = text.match(/^(#{1,6})\s/);
    if (match) {
      return {
        type: 'heading',
        consumeChars: match[0].length,
        metadata: { level: match[1].length }
      };
    }
    return null;
  },
  onKeyDown: (event, block, cursor) => {
    if (event.key === 'Enter' && cursor.offset === block.content.length) {
      // Create paragraph as child of heading
      return {
        type: 'create',
        newBlock: createBlock('paragraph', ''),
        insertAs: 'child'
      };
    }
    return { type: 'continue' };
  },
  renderInactive: (block) => {
    const h = document.createElement(`h${block.metadata.level}`);
    h.innerHTML = renderInlines(block.content, false);
    return h;
  },
  renderActive: (block) => {
    const h = document.createElement(`h${block.metadata.level}`);
    const prefix = document.createElement('span');
    prefix.className = 'md-syntax';
    prefix.textContent = '#'.repeat(block.metadata.level) + ' ';
    h.appendChild(prefix);
    h.appendChild(renderInlines(block.content, true));
    return h;
  }
}
```

### UnorderedListBlock
```typescript
{
  id: 'ul',
  name: 'Unordered List',
  matcher: (text) => {
    if (text.match(/^[-*]\s/)) {
      return { type: 'ul', consumeChars: 2 };
    }
    return null;
  },
  onKeyDown: (event, block, cursor) => {
    if (event.key === 'Enter') {
      // Create new list item
      return { type: 'create', newBlock: createBlock('ul', '') };
    }
    if (event.key === 'Tab') {
      // Convert to nested list (set as child of previous)
      return { type: 'convert', convertTo: 'nested-ul' };
    }
    return { type: 'continue' };
  }
}
```

### CheckboxBlock
```typescript
{
  id: 'checkbox',
  name: 'Checkbox',
  matcher: (text) => {
    const match = text.match(/^- \[([ x])\]\s/);
    if (match) {
      return {
        type: 'checkbox',
        consumeChars: match[0].length,
        metadata: { checked: match[1] === 'x' }
      };
    }
    return null;
  },
  renderInactive: (block) => {
    const div = document.createElement('div');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = block.metadata.checked;
    div.appendChild(checkbox);
    div.appendChild(renderInlines(block.content, false));
    return div;
  }
}
```

## Example Inline Plugins

### BoldInline
```typescript
{
  id: 'bold',
  groups: ['basic-formatting'],
  priority: 10,
  match: (text) => {
    const regex = /\*\*(.+?)\*\*/g;
    const matches = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        type: 'bold',
        raw: match[0]
      });
    }
    return matches;
  },
  parse: (markdown, match) => ({
    type: 'bold',
    content: markdown.slice(2, -2)
  }),
  serialize: (data) => `**${data.content}**`,
  renderInactive: (data) => `<strong>${data.content}</strong>`,
  renderActive: (data) => {
    // When cursor touches, render markdown syntax AND content in bold
    return `<strong>**${data.content}**</strong>`;
  },
  shortcut: 'Ctrl+B',
  canWrapSelection: true,
  wrapSelection: (text) => `**${text}**`,
  autoComplete: [
    {
      trigger: '*',     // When user types first "*"
      before: '*',      // Insert another "*" before cursor
      after: '*'        // Insert "*" after cursor → "**|*"
    }
  ]
}
```

### MarkdownLinkInline
```typescript
{
  id: 'md-link',
  groups: ['links'],
  priority: 20,
  match: (text) => {
    const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const matches = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        type: 'md-link',
        raw: match[0]
      });
    }
    return matches;
  },
  parse: (markdown, match) => {
    const [, text, url] = markdown.match(/\[([^\]]+)\]\(([^)]+)\)/);
    return {
      type: 'md-link',
      content: text,
      metadata: { url }
    };
  },
  renderInactive: (data) => {
    return `<a href="${data.metadata.url}">${data.content}</a>`;
  },
  renderActive: (data) => {
    // When cursor touches, render markdown syntax AND content as link
    return `<a href="${data.metadata.url}">[${data.content}](${data.metadata.url})</a>`;
  },
  autoComplete: [
    {
      trigger: '[',     // When user types "["
      before: '',       // Nothing before cursor
      after: ']()'      // Insert "]()" after → "[|]()"
    }
  ]
}
```

### DatahogNodeLinkInline
```typescript
{
  id: 'node-link',
  groups: ['links'],
  priority: 20,
  match: (text) => {
    const regex = /\[\[([^\]]+)\]\]/g;
    const matches = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        type: 'node-link',
        raw: match[0]
      });
    }
    return matches;
  },
  parse: (markdown, match) => {
    const [, nodeId] = markdown.match(/\[\[([^\]]+)\]\]/);
    return {
      type: 'node-link',
      content: nodeId,
      metadata: { nodeId }
    };
  },
  renderInactive: (data) => {
    // Fetch node title and render as link
    return `<a href="#/node/${data.metadata.nodeId}" class="node-link">${data.content}</a>`;
  },
  renderActive: (data) => {
    // When cursor touches, render markdown syntax AND content as link
    return `<a href="#/node/${data.metadata.nodeId}" class="node-link">[[${data.content}]]</a>`;
  },
  autoComplete: [
    {
      trigger: '[',     // When user types first "["
      before: '[',      // Insert another "[" before cursor
      after: ']]'       // Insert "]]" after → "[[|]]"
    }
  ]
}
```

## Inline Module Groups

Groups allow organizing inline plugins and attaching them to specific block types during editor initialization:

- **basic-formatting**: bold, italic, code, strikethrough
- **links**: markdown links, datahog node links
- **advanced**: highlights, footnotes, etc.

Groups are defined in `tools.inlineGroups` and attached to blocks via `BlockPluginConfig.inlineGroups`:

```typescript
const editor = new MarkdownEditor({
  holder: 'editor-container',
  tools: {
    blocks: {
      heading: {
        plugin: HeadingBlock,
        inlineGroups: ['basic-formatting', 'links']  // Heading supports these
      },
      code: {
        plugin: CodeBlock,
        inlineGroups: []  // Code block has no inline formatting
      },
      paragraph: {
        plugin: ParagraphBlock,
        inlineGroups: ['basic-formatting', 'links', 'advanced']  // Paragraph supports all
      }
    },
    inlines: { /* ... */ },
    inlineGroups: {
      'basic-formatting': ['bold', 'italic'],
      'links': ['link', 'nodeLink'],
      'advanced': ['highlight', 'footnote']
    }
  }
});
```

## State Management

### Block Tree State
```typescript
interface EditorState {
  root: Block | null; // First block in tree
  cursor: CursorPosition;
  selection: SelectionRange | null;
  history: HistoryEntry[];
  historyIndex: number;
}

interface CursorPosition {
  block: Block;
  offset: number; // Character offset in block content
}

interface SelectionRange {
  start: CursorPosition;
  end: CursorPosition;
}
```

### Reactivity
- Use RxJS Observables/Subjects for state management
- Block tree mutations trigger re-renders via state change events
- Cursor movements trigger active/inactive transitions
- Only re-render affected blocks (not entire tree)
- Observable streams for:
  - `state$`: EditorState changes
  - `cursor$`: Cursor position changes
  - `content$`: Content changes (for onChange callback)
  - `selection$`: Selection range changes

## Framework Integration

### Architecture Philosophy
The editor is built as a **framework-agnostic vanilla TypeScript library**, similar to EditorJS. It has no dependencies on UI frameworks and can be used with Angular, React, Vue, or plain JavaScript.

### Angular Integration
Since this project is an Angular 20 application, here's how to integrate the editor:

```typescript
// Angular component
import { Component, ElementRef, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { MarkdownEditor } from '@datahog/md-editor';
import { HeadingBlock, ParagraphBlock, UnorderedListBlock } from '@datahog/md-editor/plugins/blocks';
import { BoldInline, ItalicInline, MarkdownLinkInline } from '@datahog/md-editor/plugins/inlines';

@Component({
  selector: 'app-markdown-editor',
  template: '<div #editorContainer class="markdown-editor"></div>',
  styleUrls: ['./markdown-editor.component.scss']
})
export class MarkdownEditorComponent implements OnInit, OnDestroy {
  @ViewChild('editorContainer', { static: true }) editorContainer!: ElementRef;

  private editor?: MarkdownEditor;

  ngOnInit() {
    this.editor = new MarkdownEditor({
      holder: this.editorContainer.nativeElement,
      tools: {
        blocks: {
          heading: { plugin: HeadingBlock, inlineGroups: ['basic', 'links'] },
          paragraph: { plugin: ParagraphBlock, inlineGroups: ['basic', 'links'] },
          list: { plugin: UnorderedListBlock, inlineGroups: ['basic'] }
        },
        inlines: {
          bold: BoldInline,
          italic: ItalicInline,
          link: MarkdownLinkInline
        },
        inlineGroups: {
          'basic': ['bold', 'italic'],
          'links': ['link']
        }
      },
      data: '# Welcome\n\nStart editing...',
      onChange: (api, event) => {
        console.log('Content changed:', event);
        // Can emit to parent component or service
      }
    });
  }

  ngOnDestroy() {
    this.editor?.destroy();
  }

  // Public methods for parent components
  async save(): Promise<string> {
    return await this.editor?.save() || '';
  }

  async load(markdown: string): Promise<void> {
    await this.editor?.load(markdown);
  }
}
```

### Key Integration Points
1. **RxJS Compatibility**: Editor uses RxJS internally, same as Angular
2. **Lifecycle**: Editor destroyed in `ngOnDestroy` to prevent memory leaks
3. **DOM Management**: Editor manages its own DOM within the container element
4. **Change Detection**: Editor triggers callbacks that can integrate with Angular's change detection
5. **TypeScript**: Full type safety with TypeScript interfaces

## Package Configuration

### package.json
```json
{
  "name": "@datahog/md-editor",
  "version": "0.1.0",
  "description": "Framework-agnostic markdown editor with Obsidian-style mixed display mode",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./plugins/blocks": {
      "import": "./dist/plugins/blocks/index.mjs",
      "require": "./dist/plugins/blocks/index.js",
      "types": "./dist/plugins/blocks/index.d.ts"
    },
    "./plugins/inlines": {
      "import": "./dist/plugins/inlines/index.mjs",
      "require": "./dist/plugins/inlines/index.js",
      "types": "./dist/plugins/inlines/index.d.ts"
    }
  },
  "files": [
    "dist",
    "README.md"
  ],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest",
    "lint": "eslint src",
    "typecheck": "tsc --noEmit",
    "examples": "vite examples --port 3000"
  },
  "dependencies": {
    "rxjs": "^7.8.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vitest": "^1.0.0"
  },
  "keywords": [
    "markdown",
    "editor",
    "wysiwyg",
    "obsidian",
    "contenteditable"
  ],
  "author": "Datahog",
  "license": "MIT"
}
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts"]
}
```

### tsup.config.ts
```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'plugins/blocks/index': 'src/plugins/blocks/index.ts',
    'plugins/inlines/index': 'src/plugins/inlines/index.ts'
  },
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  minify: false,
  external: ['rxjs']
});
```

### Installation in Frontend
```bash
cd frontend
npm install file:../md-editor
```

Or in `frontend/package.json`:
```json
{
  "dependencies": {
    "@datahog/md-editor": "file:../md-editor"
  }
}
```

## File Structure

```
md-editor/                           (npm package at project root)
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── README.md
├── PLAN.md (this file)
├── src/
│   ├── core/
│   │   ├── MarkdownEditor.ts        (main class, instantiation entry point)
│   │   ├── BlockTree.ts
│   │   ├── BlockRenderer.ts
│   │   ├── InlineParser.ts
│   │   ├── CursorManager.ts
│   │   ├── InputHandler.ts
│   │   ├── MarkdownSerializer.ts
│   │   ├── MarkdownParser.ts
│   │   └── StateManager.ts
│   ├── types/
│   │   ├── Block.ts
│   │   ├── BlockPlugin.ts
│   │   ├── InlinePlugin.ts
│   │   ├── EditorConfig.ts
│   │   ├── EditorState.ts
│   │   ├── EditorAPI.ts
│   │   └── index.ts
│   ├── plugins/
│   │   ├── blocks/
│   │   │   ├── HeadingBlock.ts
│   │   │   ├── ParagraphBlock.ts
│   │   │   ├── UnorderedListBlock.ts
│   │   │   ├── OrderedListBlock.ts
│   │   │   ├── CheckboxBlock.ts
│   │   │   └── index.ts
│   │   └── inlines/
│   │       ├── BoldInline.ts
│   │       ├── ItalicInline.ts
│   │       ├── CodeInline.ts
│   │       ├── MarkdownLinkInline.ts
│   │       ├── NodeLinkInline.ts
│   │       └── index.ts
│   ├── utils/
│   │   ├── domUtils.ts
│   │   ├── markdownUtils.ts
│   │   └── cursorUtils.ts
│   └── index.ts                     (public API exports)
├── examples/                        (browser-based testing)
│   ├── phase1.html                  (core infrastructure)
│   ├── phase2.html                  (block system)
│   ├── phase3.html                  (inline formatting)
│   ├── phase4.html                  (advanced inlines)
│   ├── phase5.html                  (input handling)
│   ├── phase6.html                  (serialization)
│   ├── full.html                    (complete editor)
│   └── styles.css                   (shared styles for examples)
└── dist/                            (generated by build)
    ├── index.js
    ├── index.mjs
    ├── index.d.ts
    └── ...
```

## Example Page Structure

Each example HTML file follows this structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Phase 1 - Core Infrastructure</title>
  <link rel="stylesheet" href="./styles.css">
  <style>
    .editor-container {
      max-width: 800px;
      margin: 2rem auto;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 1rem;
      min-height: 400px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Phase 1: Core Infrastructure</h1>
    <p>Testing: Basic paragraph block with cursor tracking</p>
  </div>

  <div id="editor" class="editor-container"></div>

  <div class="controls">
    <button id="save">Save (log to console)</button>
    <button id="load">Load Sample</button>
    <button id="clear">Clear</button>
  </div>

  <div class="output">
    <h3>Current State:</h3>
    <pre id="state-output"></pre>
  </div>

  <script type="module">
    import { MarkdownEditor } from '../dist/index.mjs';
    import { ParagraphBlock } from '../dist/plugins/blocks/index.mjs';

    // Initialize editor for this phase
    const editor = new MarkdownEditor({
      holder: document.getElementById('editor'),
      tools: {
        blocks: {
          paragraph: { plugin: ParagraphBlock, inlineGroups: [] }
        },
        inlines: {},
        inlineGroups: {}
      },
      data: 'This is a test paragraph.',
      onChange: (api, event) => {
        // Display current state
        document.getElementById('state-output').textContent =
          JSON.stringify(event, null, 2);
      }
    });

    // Hook up controls
    document.getElementById('save').onclick = async () => {
      const markdown = await editor.save();
      console.log('Saved markdown:', markdown);
    };

    document.getElementById('load').onclick = async () => {
      await editor.load('Sample text for phase 1.');
    };

    document.getElementById('clear').onclick = () => {
      editor.clear();
    };
  </script>
</body>
</html>
```

This structure allows quick iteration and visual verification that each feature works correctly before moving to the next phase.

## Development Workflow

### Initial Setup
```bash
# In project root
mkdir md-editor
cd md-editor
npm init -y
# Edit package.json with config above
npm install
```

### Development
```bash
# Terminal 1: Watch mode for package build
cd md-editor
npm run dev

# Terminal 2: Run Angular frontend
cd ../frontend
npm start
```

The `file:../md-editor` dependency creates a symlink, so changes in the package are immediately available to the frontend after rebuild.

### Building for Production
```bash
cd md-editor
npm run build     # Creates dist/ with compiled JS, types, and source maps
```

### Testing

#### Unit Tests
```bash
cd md-editor
npm test          # Run unit tests with Vitest
npm run typecheck # TypeScript type checking
```

#### Browser Examples
Test each implementation phase in a web browser with live examples:

```bash
cd md-editor
npm run examples  # Starts a dev server at http://localhost:3000
```

Example pages available at:
- `/examples/phase1.html` - Core infrastructure & basic paragraph
- `/examples/phase2.html` - Block system with headings, lists
- `/examples/phase3.html` - Inline formatting (bold, italic)
- `/examples/phase4.html` - Advanced inlines (links, node links)
- `/examples/phase5.html` - Input handling & shortcuts
- `/examples/phase6.html` - Markdown import/export
- `/examples/full.html` - Complete editor with all features

Each example page demonstrates the features from that phase, allowing visual testing and debugging in the browser. The examples automatically reload when you rebuild the package.

### Publishing (Future)
When ready to publish to npm:
```bash
cd md-editor
npm publish --access public
```

Then update `frontend/package.json` to use the published version:
```json
{
  "dependencies": {
    "@datahog/md-editor": "^0.1.0"
  }
}
```

## Implementation Phases

### Phase 1: Core Infrastructure
- Block tree data structure
- Plugin registry
- Basic cursor management
- Single block rendering (paragraph only)

### Phase 2: Block System
- Block plugin API
- Block renderer with active/inactive states
- Block matchers and auto-conversion
- Multiple block types (heading, paragraph, lists)

### Phase 3: Inline System
- Inline plugin API
- Inline parser
- Inline rendering with active/inactive states
- Basic inline formats (bold, italic)

### Phase 4: Advanced Inlines
- Markdown links
- Datahog node links
- Inline groups

### Phase 5: Input Handling
- Keyboard event handling
- Block splitting/merging (Enter, Backspace)
- Inline shortcuts (Ctrl+B, etc.)
- Tab handling for nesting

### Phase 6: Serialization
- Markdown export
- Markdown import
- State persistence

### Phase 7: Polish
- Undo/redo
- Selection handling
- Performance optimization
- Accessibility

## Key Technical Challenges

### 1. Cursor Position Mapping
- DOM positions vs. logical block/offset positions
- Maintaining cursor position during re-renders
- Handling cursor at inline boundaries

### 2. Active/Inactive Transitions
- Detecting when cursor enters/leaves elements
- Smooth transitions without flickering
- Preserving cursor position during state change

### 3. ContentEditable Quirks
- Browser inconsistencies
- Preventing unwanted HTML insertion
- Managing composition events (IME input)

### 4. Nested Block Rendering
- Recursive rendering of child blocks
- Proper indentation and styling
- Drag-and-drop for reorganization (future)

### 5. Inline Overlap Resolution
- Multiple inline formats on same text (e.g., bold + italic)
- Priority-based rendering
- Nested inline elements (links with bold text)

## Success Criteria

1. **Functionality**
   - Create, edit, delete blocks
   - Apply inline formatting
   - Mixed display mode works correctly
   - Export/import markdown

2. **Obsidian-like Experience**
   - Markdown syntax visible only when cursor active
   - Smooth transitions between states
   - Intuitive keyboard navigation
   - Fast and responsive

3. **Extensibility**
   - Easy to add new block types
   - Easy to add new inline formats
   - Plugin API is well-documented
   - Inline groups work as expected

4. **Code Quality**
   - Type-safe TypeScript
   - Well-tested
   - Clean separation of concerns
   - Performant (handles large documents)
