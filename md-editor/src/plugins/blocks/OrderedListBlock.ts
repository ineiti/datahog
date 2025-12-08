import { Block, BlockData } from '../../types/Block.js';
import { BlockPlugin, BlockMatchResult } from '../../types/BlockPlugin.js';

/**
 * OrderedListBlock plugin
 * Supports ordered lists with "1. ", "2. ", etc. markers
 */
export const OrderedListBlock: BlockPlugin = {
  id: 'ol',
  name: 'Ordered List',

  /**
   * Detect if text should convert to ordered list
   * e.g., "1. " at start → list item
   */
  matcher(text: string, position: number): BlockMatchResult | null {
    // Only match at the start of the text
    if (position > 0) return null;

    const match = text.match(/^(\d+)\.\s/);
    if (match) {
      return {
        type: 'ol',
        consumeChars: match[0].length,
        metadata: { number: parseInt(match[1], 10) }
      };
    }
    return null;
  },

  parse(markdown: string): BlockData {
    const match = markdown.match(/^(\d+)\.\s+(.*)$/);
    if (match) {
      return {
        type: 'ol',
        content: match[2].trim(),
        metadata: { number: parseInt(match[1], 10) }
      };
    }

    // Fallback
    return {
      type: 'ol',
      content: markdown.trim(),
      metadata: { number: 1 }
    };
  },

  serialize(block: Block): string {
    // Parse the content to extract just the text without syntax
    const match = (block.content || '').match(/^(\d+)\.\s+(.*)$/);
    if (match) {
      return `${match[1]}. ${match[2]}`;
    }
    const number = block.metadata.number || 1;
    return `${number}. ${block.content}`;
  },

  renderInactive(block: Block): HTMLElement {
    const li = document.createElement('li');
    li.className = 'md-block md-list-item md-ordered';

    // Extract content without syntax
    const match = (block.content || '').match(/^\d+\.\s+(.*)$/);
    const textContent = match ? match[1] : block.content;
    li.textContent = textContent || '';

    // Note: The actual numbering will be handled by CSS list-style
    return li;
  },

  renderActive(block: Block, cursorOffset: number): HTMLElement {
    const li = document.createElement('li');
    li.className = 'md-block md-list-item md-ordered active';
    li.contentEditable = 'true';

    // Parse the content to separate syntax from text
    const text = block.content || '';
    const match = text.match(/^(\d+\.\s+)(.*)$/);

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
   * Handle splitting ordered list item when Enter is pressed
   * Returns [current list item with content before cursor, new list item with content after cursor]
   */
  onSplit(block: Block, offset: number): [Block, Block] {
    const text = block.content || '';

    // Extract the number and content
    const match = text.match(/^(\d+\.\s+)(.*)$/);
    const syntax = match ? match[1] : '1. ';
    const contentOnly = match ? match[2] : text;

    // Calculate offset within the content (excluding syntax)
    const syntaxLength = syntax.length;
    const contentOffset = Math.max(0, offset - syntaxLength);

    // Split the content at cursor position
    const beforeCursor = contentOnly.substring(0, contentOffset);
    const afterCursor = contentOnly.substring(contentOffset);

    // Update current block with content before cursor
    const currentBlock = { ...block, content: syntax + beforeCursor };

    // Create new list item with next number
    const currentNumber = block.metadata.number || 1;
    const nextNumber = currentNumber + 1;
    const newBlock: Block = {
      id: Math.random().toString(36).substring(2, 11),
      type: 'ol',
      content: `${nextNumber}. ` + afterCursor,
      metadata: { number: nextNumber },
      isActive: false,
      child: null,
      next: null
    };

    return [currentBlock, newBlock];
  }
};
