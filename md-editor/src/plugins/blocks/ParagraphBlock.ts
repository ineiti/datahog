import { Block, BlockData } from '../../types/Block.js';
import { BlockPlugin } from '../../types/BlockPlugin.js';

/**
 * ParagraphBlock plugin
 * Simple paragraph block with no special formatting
 */
export const ParagraphBlock: BlockPlugin = {
  id: 'paragraph',
  name: 'Paragraph',

  parse(markdown: string): BlockData {
    return {
      type: 'paragraph',
      content: markdown.trim(),
      metadata: {}
    };
  },

  serialize(block: Block): string {
    return block.content;
  },

  renderInactive(block: Block): HTMLElement {
    const p = document.createElement('p');
    p.className = 'md-block md-paragraph';
    p.textContent = block.content || '';
    return p;
  },

  renderActive(block: Block, cursorOffset: number): HTMLElement {
    const p = document.createElement('p');
    p.className = 'md-block md-paragraph active';
    p.contentEditable = 'true';
    p.textContent = block.content || '';
    return p;
  },

  /**
   * Handle splitting paragraph when Enter is pressed
   * Returns [current block with content before cursor, new block with content after cursor]
   */
  onSplit(block: Block, offset: number): [Block, Block] {
    const text = block.content || '';
    const beforeCursor = text.substring(0, offset);
    const afterCursor = text.substring(offset);

    // Update current block with content before cursor
    const currentBlock = { ...block, content: beforeCursor };

    // Create new paragraph with content after cursor
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
