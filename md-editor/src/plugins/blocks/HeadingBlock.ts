import { Block, BlockData } from '../../types/Block.js';
import { BlockPlugin, BlockMatchResult } from '../../types/BlockPlugin.js';

/**
 * HeadingBlock plugin
 * Supports headings level 1-6
 * Matcher: Converts "# ", "## ", etc. at start of line to heading
 */
export const HeadingBlock: BlockPlugin = {
  id: 'heading',
  name: 'Heading',

  /**
   * Detect if text should convert to heading block
   * e.g., "# " at start → heading level 1
   */
  matcher(text: string, position: number): BlockMatchResult | null {
    // Only match at the start of the text
    if (position > 0) return null;

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

  parse(markdown: string): BlockData {
    const match = markdown.match(/^(#{1,6})\s+(.*)$/);
    if (match) {
      return {
        type: 'heading',
        content: match[2].trim(),
        metadata: { level: match[1].length }
      };
    }

    // Fallback: default to level 1
    return {
      type: 'heading',
      content: markdown.trim(),
      metadata: { level: 1 }
    };
  },

  serialize(block: Block): string {
    // Parse the content to extract just the text without syntax
    const match = (block.content || '').match(/^(#{1,6})\s+(.*)$/);
    if (match) {
      return `${match[1]} ${match[2]}`;
    }
    // Fallback: use metadata to reconstruct
    const level = block.metadata.level || 1;
    const hashes = '#'.repeat(level);
    return `${hashes} ${block.content}`;
  },

  renderInactive(block: Block): HTMLElement {
    const level = block.metadata.level || 1;
    const h = document.createElement(`h${level}`) as HTMLElement;
    h.className = 'md-block md-heading';

    // Extract content without syntax
    const match = (block.content || '').match(/^#{1,6}\s+(.*)$/);
    const textContent = match ? match[1] : block.content;
    h.textContent = textContent || '';

    return h;
  },

  renderActive(block: Block, cursorOffset: number): HTMLElement {
    const level = block.metadata.level || 1;
    const h = document.createElement(`h${level}`) as HTMLElement;
    h.className = 'md-block md-heading active';
    h.contentEditable = 'true';

    // Parse the content to separate syntax from text
    const text = block.content || '';
    const match = text.match(/^(#{1,6}\s+)(.*)$/);

    if (match) {
      // Create a span for the syntax that's styled but editable
      const syntaxSpan = document.createElement('span');
      syntaxSpan.className = 'md-syntax';
      syntaxSpan.textContent = match[1]; // The actual syntax from content
      h.appendChild(syntaxSpan);

      // Content after syntax - wrap in span to ensure proper color
      const contentSpan = document.createElement('span');
      contentSpan.className = 'md-content';
      contentSpan.textContent = match[2];
      h.appendChild(contentSpan);
    } else {
      // Fallback: just show the text as-is
      const textNode = document.createTextNode(text);
      h.appendChild(textNode);
    }

    return h;
  },

  /**
   * Handle splitting heading when Enter is pressed
   * Common UX: new block becomes a paragraph (not another heading)
   * Returns [current heading with content before cursor, new paragraph with content after cursor]
   */
  onSplit(block: Block, offset: number): [Block, Block] {
    const text = block.content || '';

    // Extract the heading syntax and content
    const match = text.match(/^(#{1,6}\s+)(.*)$/);
    const syntax = match ? match[1] : '# ';
    const contentOnly = match ? match[2] : text;

    // Calculate offset within the content (excluding syntax)
    const syntaxLength = syntax.length;
    const contentOffset = Math.max(0, offset - syntaxLength);

    // Split the content at cursor position
    const beforeCursor = contentOnly.substring(0, contentOffset);
    const afterCursor = contentOnly.substring(contentOffset);

    // Update current block (heading) with content before cursor
    const currentBlock = { ...block, content: syntax + beforeCursor };

    // Create new paragraph (not heading) with content after cursor
    const newBlock: Block = {
      id: Math.random().toString(36).substring(2, 11),
      type: 'paragraph',
      content: afterCursor,
      metadata: {},
      isActive: false,
      child: null,
      next: null
    };

    return [currentBlock, newBlock];
  }
};
