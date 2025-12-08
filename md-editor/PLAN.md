# Markdown Editor Architecture Plan

## Overview

A block-based markdown editor with mixed display mode (Obsidian-style): markdown source is edited and stored, but displayed as HTML. Markdown syntax becomes visible only when the cursor is active in that element.

**Architecture**: Framework-agnostic vanilla TypeScript library (similar to EditorJS) that can be used with any framework including Angular, React, Vue, or plain JavaScript. Uses RxJS for state management and vanilla DOM manipulation for rendering.

**Distribution**: Standalone npm package (`@datahog/md-editor`) located in `/md-editor` directory at the project root.

## Current Status

- **Phase 1 (Core Infrastructure)**: ✅ Complete
- **Phase 2 (Block System)**: ✅ Complete
- **Phase 3 (Inline Plugins)**: 🔄 In Progress
- **Phase 4 (Advanced Inlines)**: Pending
- **Phase 5 (Polish)**: Pending

## Core Data Structure

### Block Tree
Blocks form a hierarchical tree structure where each block has:
- **child**: Optional nested block (for content under headings, or list items containing sublists)
- **next**: Optional sibling block (next block at same level)
- **content**: Text content with inline formatting
- **type**: Block type identifier (heading, list, etc.)
- **metadata**: Type-specific data (heading level, list style, etc.)

## Inline Plugin API

```typescript
interface InlinePlugin {
  // Unique identifier
  id: string;

  // Display name
  name: string;

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
}

interface InlineMatch {
  start: number;    // Start position in text
  end: number;      // End position in text
  type: string;     // Inline type
  raw: string;      // Raw markdown text
}

interface InlineData {
  type: string;
  content: string;  // Inner content
  metadata?: Record<string, any>;  // Type-specific data (e.g., URL for links)
}
```

## Implementation Phases

### Phase 3: Inline Plugins (Current)
- Inline plugin API implementation
- InlineParser to detect and parse inline formatting
- Inline rendering with active/inactive states
- Basic inline formats: **bold**, *italic*, `code`
- Cursor position tracking within inline elements

### Phase 4: Advanced Inlines
- Markdown links: `[text](url)`
- Inline shortcuts (Ctrl+B for bold, Ctrl+I for italic, etc.)
- Selection wrapping (select text, press Ctrl+B to bold)
- Nested inline formats (bold inside italic, etc.)

### Phase 5: Polish
- Undo/redo support
- Selection handling improvements
- Performance optimization for large documents
- Accessibility (ARIA attributes, keyboard navigation)
- Edge case handling and bug fixes
- Simplify block and inline plugins by moving as much generic functionality to the core as possible

## Key Technical Challenges

### Cursor Position Mapping for Inlines
- DOM positions vs. logical block/offset positions
- Maintaining cursor position during re-renders
- Handling cursor at inline boundaries (entering/leaving formatted regions)

### Active/Inactive Transitions
- Detecting when cursor enters/leaves inline elements
- Smooth transitions without flickering
- Preserving cursor position during state change

### Inline Overlap Resolution
- Multiple inline formats on same text (e.g., bold + italic)
- Priority-based rendering
- Nested inline elements (links with bold text)

## Success Criteria

1. **Functionality**
   - Apply inline formatting (bold, italic, code)
   - Links work correctly
   - Mixed display mode works (syntax visible only when cursor active)
   - Keyboard shortcuts work

2. **Obsidian-like Experience**
   - Markdown syntax visible only when cursor active in that element
   - Smooth transitions between states
   - Intuitive keyboard navigation

3. **Extensibility**
   - Easy to add new inline formats via plugin system
   - Plugin API is well-documented

4. **Code Quality**
   - Type-safe TypeScript
   - Clean separation of concerns
   - Performant rendering
