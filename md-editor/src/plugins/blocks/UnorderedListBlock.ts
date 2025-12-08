import { Block, BlockData } from '../../types/Block.js';
import { BlockPlugin, BlockMatchResult } from '../../types/BlockPlugin.js';

/**
 * UnorderedListBlock plugin
 * Supports unordered lists with "- " or "* " markers
 */
export const UnorderedListBlock: BlockPlugin = {
  id: 'ul',
  name: 'Unordered List',

  /**
   * Detect if text should convert to unordered list
   * e.g., "- " or "* " at start → list item
   */
  matcher(text: string, position: number): BlockMatchResult | null {
    // Only match at the start of the text
    if (position > 0) return null;

    const match = text.match(/^[-*]\s/);
    if (match) {
      return {
        type: 'ul',
        consumeChars: match[0].length,
        metadata: {}
      };
    }
    return null;
  },

  parse(markdown: string): BlockData {
    const match = markdown.match(/^[-*]\s+(.*)$/);
    if (match) {
      return {
        type: 'ul',
        content: match[1].trim(),
        metadata: {}
      };
    }

    // Fallback
    return {
      type: 'ul',
      content: markdown.trim(),
      metadata: {}
    };
  },

  serialize(block: Block): string {
    // Parse the content to extract just the text without syntax
    const match = (block.content || '').match(/^[-*]\s+(.*)$/);
    if (match) {
      return `- ${match[1]}`;
    }
    return `- ${block.content}`;
  },

  renderInactive(block: Block): HTMLElement {
    const li = document.createElement('li');
    li.className = 'md-block md-list-item';

    // Extract content without syntax
    const match = (block.content || '').match(/^[-*]\s+(.*)$/);
    const textContent = match ? match[1] : block.content;
    li.textContent = textContent || '';

    return li;
  },

  renderActive(block: Block, cursorOffset: number): HTMLElement {
    const li = document.createElement('li');
    li.className = 'md-block md-list-item active';
    li.contentEditable = 'true';

    // Parse the content to separate syntax from text
    const text = block.content || '';
    const match = text.match(/^([-*]\s+)(.*)$/);

    if (match) {
      // Create a span for the syntax that's styled but editable
      const syntaxSpan = document.createElement('span');
      syntaxSpan.className = 'md-syntax';
      syntaxSpan.textContent = match[1]; // The actual syntax from content
      li.appendChild(syntaxSpan);

      // Content after syntax - wrap in span to ensure proper color
      const contentSpan = document.createElement('span');
      contentSpan.className = 'md-content';
      // If content is empty, use zero-width space to preserve structure
      contentSpan.textContent = match[2] || '\u200B';
      li.appendChild(contentSpan);
    } else {
      // Fallback: just show the text as-is
      const textNode = document.createTextNode(text);
      li.appendChild(textNode);
    }

    return li;
  },

  /**
   * Handle splitting list item when Enter is pressed
   * Returns [current list item with content before cursor, new list item with content after cursor]
   */
  onSplit(block: Block, offset: number): [Block, Block] {
    const text = block.content || '';

    // Extract the syntax prefix and content
    const match = text.match(/^([-*]\s+)(.*)$/);
    const syntax = match ? match[1] : '- ';
    const contentOnly = match ? match[2] : text;

    // Calculate offset within the content (excluding syntax)
    const syntaxLength = syntax.length;
    const contentOffset = Math.max(0, offset - syntaxLength);

    // Split the content at cursor position
    const beforeCursor = contentOnly.substring(0, contentOffset);
    const afterCursor = contentOnly.substring(contentOffset);

    // Update current block with content before cursor
    const currentBlock = { ...block, content: syntax + beforeCursor };

    // Create new list item with content after cursor
    const newBlock: Block = {
      id: Math.random().toString(36).substring(2, 11),
      type: 'ul',
      content: '- ' + afterCursor,
      metadata: {},
      isActive: false,
      child: null,
      next: null
    };

    return [currentBlock, newBlock];
  }
};
