import { Block, BlockData } from "../../types/Block.js";
import { BlockPlugin, BlockMatchResult } from "../../types/BlockPlugin.js";
import { appendSyntaxContentSpans } from "../../utils/domUtils.js";
import { BlockTree } from "../../core/BlockTree.js";

/**
 * HeadingBlock plugin
 * Supports headings level 1-6
 * Matcher: Converts "# ", "## ", etc. at start of line to heading
 */

const PATTERNS = {
  matcher: /^(#{1,6})\s/,
  extractContent: /^#{1,6}\s+(.*)$/,
  splitSyntaxContent: /^(#{1,6}\s+)(.*)$/,
};

export class HeadingBlock implements BlockPlugin {
  id = "heading";
  name = "Heading";
  needsRerenderOnInput = true;

  /**
   * Detect if text should convert to heading block
   * e.g., "# " at start → heading level 1
   */
  matcher(text: string, position: number): BlockMatchResult | null {
    // Only match at the start of the text
    if (position > 0) return null;

    const match = text.match(PATTERNS.matcher);
    if (match) {
      return {
        type: "heading",
        consumeChars: match[0].length,
        metadata: { level: match[1].length },
      };
    }
    return null;
  }

  parse(markdown: string): BlockData {
    const match = markdown.match(PATTERNS.splitSyntaxContent);
    if (match) {
      return {
        type: "heading",
        content: match[2].trim(),
        metadata: { level: match[1].length },
      };
    }

    // Fallback: default to level 1
    return {
      type: "heading",
      content: markdown.trim(),
      metadata: { level: 1 },
    };
  }

  serialize(block: Block): string {
    // Parse the content to extract just the text without syntax
    const match = (block.content || "").match(PATTERNS.splitSyntaxContent);
    if (match) {
      return `${match[1]} ${match[2]}`;
    }
    // Fallback: use metadata to reconstruct
    const level = block.metadata.level || 1;
    const hashes = "#".repeat(level);
    return `${hashes} ${block.content}`;
  }

  renderInactive(block: Block): HTMLElement {
    const level = block.metadata.level || 1;
    const h = document.createElement(`h${level}`) as HTMLElement;
    h.className = "md-block md-heading";

    // Create content wrapper
    const contentWrapper = document.createElement("div");
    contentWrapper.className = "md-block-content";

    // Extract content without syntax
    const match = (block.content || "").match(PATTERNS.extractContent);
    const textContent = match ? match[1] : block.content;
    contentWrapper.textContent = textContent || "";

    h.appendChild(contentWrapper);
    return h;
  }

  renderActive(block: Block, cursorOffset: number): HTMLElement {
    const level = block.metadata.level || 1;
    const h = document.createElement(`h${level}`) as HTMLElement;
    h.className = "md-block md-heading";

    // Create content wrapper
    const contentWrapper = document.createElement("div");
    contentWrapper.className = "md-block-content active";
    contentWrapper.contentEditable = "true";

    // Parse the content to separate syntax from text
    const text = block.content || "";
    const match = text.match(PATTERNS.splitSyntaxContent);

    if (match) {
      appendSyntaxContentSpans(contentWrapper, match[1], match[2]);
    } else {
      // Fallback: just show the text as-is
      const textNode = document.createTextNode(text);
      contentWrapper.appendChild(textNode);
    }

    h.appendChild(contentWrapper);
    return h;
  }

  /**
   * Handle splitting heading when Enter is pressed
   * Common UX: new block becomes a paragraph (not another heading)
   * Returns [current heading with content before cursor, new paragraph with content after cursor]
   */
  onSplit(block: Block, offset: number): [Block, Block] {
    const text = block.content || "";

    // Extract the heading syntax and content
    const match = text.match(PATTERNS.splitSyntaxContent);
    const syntax = match ? match[1] : "# ";
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
    const text = block.content || "";
    const match = text.match(PATTERNS.extractContent);
    return match ? match[1] : text;
  }

  getSyntaxLength(block: Block): number {
    const level = block.metadata.level || 1;
    return level + 1; // "# " = level hashes + 1 space
  }

  reconstructContent(
    cleanContent: string,
    metadata: Record<string, any>,
  ): string {
    const level = metadata.level || 1;
    return "#".repeat(level) + " " + cleanContent;
  }

  shouldAddEmptyLineBefore(previousBlockType: string | null): boolean {
    // Add empty line before all blocks (non-list always adds empty line)
    return previousBlockType !== null;
  }

  positionCursorAfterCreate(element: HTMLElement): void {
    // For headings, place cursor at start
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
