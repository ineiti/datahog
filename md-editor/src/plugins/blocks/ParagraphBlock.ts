import { Block, BlockData } from "../../types/Block.js";
import { BlockPlugin } from "../../types/BlockPlugin.js";
import { BlockTree } from "../../core/BlockTree.js";

/**
 * ParagraphBlock plugin
 * Simple paragraph block with no special formatting
 */
export class ParagraphBlock implements BlockPlugin {
  id = "paragraph";
  name = "Paragraph";
  needsRerenderOnInput = false;

  parse(markdown: string): BlockData {
    return {
      type: "paragraph",
      content: markdown.trim(),
      metadata: {},
    };
  }

  serialize(block: Block): string {
    return block.content;
  }

  renderInactive(block: Block): HTMLElement {
    const p = document.createElement("p");
    p.className = "md-block md-paragraph";
    const contentWrapper = document.createElement("div");
    contentWrapper.className = "md-block-content";
    contentWrapper.textContent = block.content || "";

    p.appendChild(contentWrapper);
    return p;
  }

  renderActive(block: Block, cursorOffset: number): HTMLElement {
    const p = document.createElement("p");
    p.className = "md-block md-paragraph";

    // Create content wrapper
    const contentWrapper = document.createElement("div");
    contentWrapper.className = "md-block-content active";
    contentWrapper.contentEditable = "true";
    contentWrapper.textContent = block.content || "";

    p.appendChild(contentWrapper);
    return p;
  }

  /**
   * Handle splitting paragraph when Enter is pressed
   * Returns [current block with content before cursor, new block with content after cursor]
   */
  onSplit(block: Block, offset: number): [Block, Block] {
    const text = block.content || "";
    const beforeCursor = text.substring(0, offset);
    const afterCursor = text.substring(offset);

    // Update current block with content before cursor
    const currentBlock = { ...block, content: beforeCursor };

    // Create new paragraph with content after cursor
    const newBlock: Block = {
      id: BlockTree.generateId(),
      type: "paragraph",
      content: afterCursor,
      metadata: {},
      isActive: false,
      child: null,
      next: null,
    };

    return [currentBlock, newBlock];
  }

  extractContent(block: Block): string {
    // Paragraph has no syntax, return content as-is
    return block.content || "";
  }

  getSyntaxLength(block: Block): number {
    // Paragraph has no syntax
    return 0;
  }

  reconstructContent(
    cleanContent: string,
    metadata: Record<string, any>,
  ): string {
    // Paragraph has no syntax, return content as-is
    return cleanContent;
  }

  shouldAddEmptyLineBefore(previousBlockType: string | null): boolean {
    // Add empty line before all blocks (non-list always adds empty line)
    return previousBlockType !== null;
  }

  positionCursorAfterCreate(element: HTMLElement): void {
    // For paragraphs, place cursor at start
    const range = document.createRange();
    const sel = window.getSelection();

    // Walk through text nodes to find the first one
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
    );

    const textNode = walker.nextNode();
    if (textNode) {
      range.setStart(textNode, 0);
      range.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }
}
