# @datahog/md-editor

A framework-agnostic block-based markdown editor with Obsidian-style mixed display mode. Markdown source is edited and stored, but displayed as HTML. Markdown syntax becomes visible only when the cursor is active in that element.

## What

A vanilla TypeScript library that provides a modern markdown editing experience similar to Obsidian or Notion. The editor stores markdown text but displays rendered HTML. When you click on a block, it switches to edit mode showing the raw markdown, and switches back to display mode when you click away.

Built with RxJS for state management and vanilla DOM manipulation for maximum compatibility and minimal bundle size.

## Why

Existing markdown editors fall into two camps:
- **Pure source editors** (CodeMirror, Monaco): Show only raw markdown, requiring users to mentally parse the syntax
- **WYSIWYG editors** (TipTap, Lexical): Store HTML or custom formats, making them unsuitable when markdown is your source of truth

This editor bridges that gap: it stores and operates on **pure markdown** while providing a **WYSIWYG-like experience**. This makes it ideal for applications that need to persist markdown but want to offer users a modern editing interface.

## Installation

```bash
npm install @datahog/md-editor
```

## Quick Example

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="node_modules/@datahog/md-editor/dist/md-editor.css">
</head>
<body>
  <div id="editor"></div>

  <script type="module">
    import { MarkdownEditor } from '@datahog/md-editor';
    import {
      ParagraphBlock,
      HeadingBlock,
      UnorderedListBlock
    } from '@datahog/md-editor/plugins/blocks';

    const editor = new MarkdownEditor({
      holder: document.getElementById('editor'),
      tools: {
        blocks: [
          new ParagraphBlock(),
          new HeadingBlock(),
          new UnorderedListBlock()
        ],
      },
      data: '# Hello World\n\nThis is a **markdown** editor.',
      onChange: async (api, event) => {
        const markdown = await api.save();
        console.log('Current markdown:', markdown);
      }
    });

    // Save to markdown
    const markdown = await editor.save();

    // Load from markdown
    await editor.load('# New Content\n\nParagraph here.');
  </script>
</body>
</html>
```

## Features

- **Mixed Display Mode**: Edit markdown, display HTML
- **Auto-conversion**: Type `# ` for headings, `- ` for lists, etc.
- **Block System**: Extensible plugin architecture for block types
- **Framework-agnostic**: Works with Angular, React, Vue, or vanilla JavaScript
- **Nested Lists**: Full support for nested list items with Tab/Shift+Tab
- **Type-safe**: Written in TypeScript with full type definitions

## Usage Tips

- Type markdown syntax at the start of a line for auto-conversion:
  - `# ` to `######` for headings (H1-H6)
  - `- ` or `* ` for unordered lists
  - `1. ` for ordered lists
- Press `Tab` in a list item to indent (nest) it
- Press `Shift+Tab` to unindent
- Press `Enter` to create a new block
- Click on any block to activate edit mode
- Click outside to deactivate and see rendered HTML

## Development

```bash
# Build the library
npm run build

# Watch mode for development
npm run dev

# Run tests
npm test

# Run examples locally
npm run examples
```

## License

This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.

See [LICENSE](LICENSE) for the full license text.

## LLM Warning

This code has been written by Claude Code, driven by Linus Gasser for the c4dt.epfl.ch.
Linus did NOT read all the code, it probably contains many bugs.
Testing is mostly done using the [examples], and the trying out different things.
