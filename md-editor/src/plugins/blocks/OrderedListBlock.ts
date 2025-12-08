import { Block, BlockData } from "../../types/Block.js";
import { BlockPlugin, BlockMatchResult } from "../../types/BlockPlugin.js";
import { appendSyntaxContentSpans } from "../../utils/domUtils.js";
import { BlockTree } from "../../core/BlockTree.js";

/**
 * OrderedListBlock plugin
 * Supports ordered lists with "1. ", "2. ", etc. markers
 */

const PATTERNS = {
  matcher: /^(\d+)\.\s/,
  extractContent: /^\d+\.\s+(.*)$/,
  splitSyntaxContent: /^(\d+\.\s+)(.*)$/,
};

export class OrderedListBlock implements BlockPlugin {
  id = "ol";
  name = "Ordered List";
  needsRerenderOnInput = true;

  /**
   * Detect if text should convert to ordered list
   * e.g., "1. " at start → list item
   */
  matcher(text: string, position: number): BlockMatchResult | null {
    // Only match at the start of the text
    if (position > 0) return null;

    const match = text.match(PATTERNS.matcher);
    if (match) {
      return {
        type: "ol",
        consumeChars: match[0].length,
        metadata: { number: parseInt(match[1], 10) },
      };
    }
    return null;
  }

  parse(markdown: string): BlockData {
    const match = markdown.match(PATTERNS.splitSyntaxContent);
    if (match) {
      return {
        type: "ol",
        content: match[2].trim(),
        metadata: { number: parseInt(match[1], 10) },
      };
    }

    // Fallback
    return {
      type: "ol",
      content: markdown.trim(),
      metadata: { number: 1 },
    };
  }

  serialize(block: Block): string {
    // Parse the content to extract just the text without syntax
    const match = (block.content || "").match(PATTERNS.splitSyntaxContent);
    if (match) {
      return `${match[1]} ${match[2]}`;
    }
    const number = block.metadata.number || 1;
    return `${number}. ${block.content}`;
  }

  renderInactive(block: Block): HTMLElement {
    const li = document.createElement("li");
    li.className = "md-block md-list-item md-ordered";

    // Create content wrapper that will receive the active class
    const contentWrapper = document.createElement("div");
    contentWrapper.className = "md-block-content";

    // Extract content without syntax
    const match = (block.content || "").match(PATTERNS.extractContent);
    const textContent = match ? match[1] : block.content;
    contentWrapper.textContent = textContent || "";

    // Note: The actual numbering will be handled by CSS list-style
    li.appendChild(contentWrapper);
    return li;
  }

  renderActive(block: Block, cursorOffset: number): HTMLElement {
    const li = document.createElement("li");
    li.className = "md-block md-list-item md-ordered";

    // Create content wrapper that will receive the active class
    const contentWrapper = document.createElement("div");
    contentWrapper.className = "md-block-content active";
    contentWrapper.contentEditable = "true";

    // Parse the content to separate syntax from text
    const text = block.content || "";
    const match = text.match(PATTERNS.splitSyntaxContent);

    if (match) {
      appendSyntaxContentSpans(contentWrapper, match[1], match[2], true);
    } else {
      // Fallback: just show the text as-is
      const textNode = document.createTextNode(text);
      contentWrapper.appendChild(textNode);
    }

    li.appendChild(contentWrapper);
    return li;
  }

  /**
   * Handle splitting ordered list item when Enter is pressed
   * Returns [current list item with content before cursor, new list item with content after cursor]
   */
  onSplit(block: Block, offset: number): [Block, Block] {
    const text = block.content || "";

    // Extract the number and content
    const match = text.match(PATTERNS.splitSyntaxContent);
    const syntax = match ? match[1] : "1. ";
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
      id: BlockTree.generateId(),
      type: "ol",
      content: `${nextNumber}. ` + afterCursor,
      metadata: { number: nextNumber },
      isActive: false,
      child: null,
      next: null,
    };

    return [currentBlock, newBlock];
  }

  extractContent(block: Block): string {
    const text = block.content || "";
    const match = text.match(PATTERNS.extractContent);
    return match ? match[1] : text;
  }

  getSyntaxLength(block: Block): number {
    const number = block.metadata.number || 1;
    return number.toString().length + 2; // "1. " = number + ". "
  }

  reconstructContent(
    cleanContent: string,
    metadata: Record<string, any>,
  ): string {
    const number = metadata.number || 1;
    return number + ". " + cleanContent;
  }

  shouldAddEmptyLineBefore(previousBlockType: string | null): boolean {
    // Add empty line unless previous block is also a list
    const isPrevList = previousBlockType === "ul" || previousBlockType === "ol";
    return previousBlockType !== null && !isPrevList;
  }

  positionCursorAfterCreate(element: HTMLElement): void {
    // For list items, place cursor in the content span (after syntax)
    const contentSpan = element.querySelector(".md-content");
    if (contentSpan) {
      const range = document.createRange();
      const sel = window.getSelection();

      if (
        contentSpan.firstChild &&
        contentSpan.firstChild.nodeType === Node.TEXT_NODE
      ) {
        range.setStart(contentSpan.firstChild, 0);
      } else {
        range.selectNodeContents(contentSpan);
      }
      range.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }
}
