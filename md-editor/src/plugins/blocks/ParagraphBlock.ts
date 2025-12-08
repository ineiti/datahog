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
  }
};
