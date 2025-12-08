# Phase 2 Cleanup

# Define classes as classes

Instead of having `export const` to define a class, use `export class`.

# Initialization

Can the following

```typescript
        blocks: {
          paragraph: { plugin: ParagraphBlock, inlineGroups: [] },
          heading: { plugin: HeadingBlock, inlineGroups: [] },
          ul: { plugin: UnorderedListBlock, inlineGroups: [] }
        },
        inlines: {},
        inlineGroups: {}
```

be changed to

```typescript
        blocks: [
          ParagraphBlock{ /* Configuration */ },
          HeadingBlock{},
          UnorderedListBlock{},
        ],
```

?

# Display

Flickering when typing something in a block.

# Soft Wrap Navigation

When a block overflows (soft wraps) over multiple lines, the navigation with cursor up / cursor down should first navigate within the block, before navigating out of the block.

Also add an example of a very long block to test the navigation, both for paragraphs and list entries.

## Markdown Export

When exporting indented lists, the markdown needs to be indented, too.

## List Indention

In the following list:

1. something
  1. sub-something
  2.

when the cursor is on the 2., and 'enter' is pressed, it should first create:

1. something
  1. sub-something
2.

and on another press on 'enter':

1. something
  1. sub-something
paragraph

The same should happen if "shift-tab" is pressed when on 2.

## Numbered Lists

Numbered lists should start counting from 1. For example:

- a
- b

1. something
2. something

should not be rendered as

- a
- b

3. something
4. something

## Indented list entries

Pressing tab anywhere in a list entry indents the list to create a sub-list.
This is a list entry stored as a 'child' of the parent entry.

## Markdown Conversion

When converting to markdown, a block after list entry should be prepended
with a newline if it's not a list entry.

## Empty List Entry Conversion

When pressing 'enter' on an empty list entry, the empty list entry must convert to a paragraph.
Same goes if the cursor is at the beginning of a list entry, and the previous list entry is empty.

6. Define constants for magic values like \u200B (zero-width space)

5. Remove redundant comments, add comments for complex algorithms

4. Make plugins use BlockTree.generateId() instead of inline ID generation

3. Consolidate regex patterns - define once per plugin:
   - HeadingBlock: 6 regex uses → 3 patterns (matcher, extractContent, splitSyntaxContent)
   - UnorderedListBlock: 6 regex uses → 3 patterns
   - OrderedListBlock: 6 regex uses → 3 patterns

   Define at top of each plugin file:
   ```typescript
   const PATTERNS = { matcher: /.../, extractContent: /.../, splitSyntaxContent: /.../ };
   ```

2. Create shared utility for syntax/content span rendering pattern:
   Replace duplicated span creation in HeadingBlock (L81-100), UnorderedListBlock (L79-96), OrderedListBlock (L81-98).

   Create in domUtils.ts:
   ```typescript
   appendSyntaxContentSpans(parent: HTMLElement, syntax: string, content: string, useZeroWidthFallback?: boolean)
   ```

1. Move block-type-specific methods from MarkdownEditor.ts to BlockPlugin interface:
   Move these 5 methods that use if/else for block types to plugin methods:

   a) `extractContentWithoutSyntax()` (lines 640-657)
      → Move to BlockPlugin as: `extractContent(block: Block): string`

   b) `getSyntaxLength()` (lines 684-697)
      → Move to BlockPlugin as: `getSyntaxLength(block: Block): number`

   c) `reconstructBlockContent()` (lines 662-679)
      → Move to BlockPlugin as: `reconstructContent(cleanContent: string, metadata: Record<string, any>): string`

   d) `save()` empty line logic (lines 940-943)
      → Move to BlockPlugin as: `shouldAddEmptyLineBefore(previousBlockType: string | null): boolean`

   e) `handleKeyDown()` cursor positioning (lines 360-379 in setTimeout)
      → Move to BlockPlugin as: `positionCursorAfterCreate(element: HTMLElement): void`

   Files: BlockPlugin.ts (add methods), MarkdownEditor.ts (call plugins), all 4 block plugins (implement)

# Phase 2

- Examples
please add an index.html with links to the different example pages

- Block editing 3
current: 'delete' at the end of the block is ignored
wanted: 'delete' at the end of the block merges the block below and keeps the cursor at the same position

- Block editing 2
current: when pressing enter after the first word in the block "text# heading", so that the second
block is "# heading", the "# heading" is not interpreted and stays as a paragraph.
wanted: "# heading" at the beginning of a paragraph should be interpreted as a heading. 
Except for lists, where it should still create a "- # heading" entry.

- Block editing 1
current: when 'enter' is pressed anywhere in the block, a new empty block is created
wanted: when 'enter' is pressed, the part to the right of the cursor must be moved to the new block

- Phase2.html
current: Uncaught (in promise) ReferenceError: Cannot access 'editor' before initialization
    at Object.onReady (phase2.html:262:26)
    at MarkdownEditor.initialize (MarkdownEditor.ts:92:19)
    at new MarkdownEditor (MarkdownEditor.ts:40:10)
    at phase2.html:242:20
wanted: no error

- List improvement 3
current: when an unordered list is followed by a counting list, the counting list includes the unordered list in its count. In the "Phase 2" example, the counting list starts at 5.
wanted: in the "Phase 2" example, the counting list should start at 1

- List improvement 2
current: lots of space between list elements
wanted: make list elements closer to each other

- List improvement 1
current: when in a list element, '-' or '1.', and pressing enter, a paragraph block is created
wanted: when pressing enter in a list element, a new list element should appear
