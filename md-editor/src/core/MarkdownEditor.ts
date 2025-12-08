import { EditorConfig, ChangeEvent } from "../types/EditorConfig.js";
import { EditorAPI } from "../types/EditorAPI.js";
import { Block } from "../types/Block.js";
import { BlockTree } from "./BlockTree.js";
import { BlockPlugin, BlockMatchResult } from "../types/BlockPlugin.js";
import { ZERO_WIDTH_SPACE } from "../utils/constants.js";

/**
 * MarkdownEditor - Main editor class
 * Phase 1: Basic infrastructure with single paragraph block
 */
export class MarkdownEditor implements EditorAPI {
  private config: EditorConfig;
  private holder: HTMLElement;
  private root: Block | null = null;
  private blockPlugins: Map<string, BlockPlugin> = new Map();
  private editorElement: HTMLElement | null = null;

  constructor(config: EditorConfig) {
    this.config = config;

    if (typeof config.holder === "string") {
      const element = document.getElementById(config.holder);
      if (!element) {
        throw new Error(`Element with id "${config.holder}" not found`);
      }
      this.holder = element;
    } else {
      this.holder = config.holder;
    }

    if (config.tools.blocks) {
      for (const plugin of config.tools.blocks) {
        this.blockPlugins.set(plugin.id, plugin);
      }
    }

    this.initialize();
  }

  private initialize(): void {
    this.editorElement = document.createElement("div");
    this.editorElement.className = "md-editor";
    this.holder.appendChild(this.editorElement);

    if (this.config.data) {
      if (typeof this.config.data === "string") {
        this.loadMarkdown(this.config.data);
      } else if (
        this.config.data.blocks &&
        this.config.data.blocks.length > 0
      ) {
        this.root = BlockTree.fromData(this.config.data.blocks[0]);
      }
    }

    if (!this.root) {
      this.root = BlockTree.createBlock("paragraph", "");
    }

    if (this.root) {
      this.root.isActive = true;
    }

    this.render();
    this.setupEventListeners();

    if (this.config.autofocus !== false) {
      setTimeout(() => {
        const firstBlock = this.editorElement?.querySelector(
          '[contenteditable="true"]',
        ) as HTMLElement;
        if (firstBlock) {
          firstBlock.focus();
        }
      }, 0);
    }

    if (this.config.onReady) {
      this.config.onReady(this);
    }
  }

  private setupEventListeners(): void {
    if (!this.editorElement) return;

    this.editorElement.addEventListener("input", (e) => {
      this.handleInput(e);
    });

    this.editorElement.addEventListener("mousedown", (e) => {
      this.handleMouseDown(e);
    });

    this.editorElement.addEventListener("keydown", (e) => {
      this.handleKeyDown(e);
    });
  }

  private handleInput(e: Event): void {
    const target = e.target as HTMLElement;
    if (!target) return;

    const blockElement = this.getBlockElementFromTarget(target);
    if (!blockElement) return;

    // Find the block that was edited
    const blockId = blockElement.getAttribute("data-block-id");
    if (!blockId) return;

    const block = BlockTree.findBlockById(this.root, blockId);
    if (!block) return;

    // Get the editable element
    const editableElement = this.getEditableElement(blockElement);
    if (!editableElement) return;

    // Store cursor offset BEFORE getting new content
    const sel = window.getSelection();
    let cursorOffset = 0;
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      cursorOffset = this.getCursorOffsetInBlock(range, editableElement);
    }

    // Get current text content
    const textContent = this.getBlockTextContent(editableElement);
    const oldType = block.type;
    block.content = textContent;

    // Check if block should be converted based on matchers
    this.checkBlockMatchers(block, textContent);

    // Determine if re-render is needed
    const typeChanged = block.type !== oldType;
    const plugin = this.blockPlugins.get(block.type);
    const needsRerenderOnInput = plugin?.needsRerenderOnInput ?? false;

    if (typeChanged) {
      // Block type changed, need full re-render
      this.render();

      // Restore cursor position after re-render
      setTimeout(() => {
        const blockElement = this.editorElement?.querySelector(
          `[data-block-id="${blockId}"]`,
        ) as HTMLElement;
        const editableElement = blockElement
          ? this.getEditableElement(blockElement)
          : null;
        if (editableElement) {
          editableElement.focus();
          this.setCursorAtOffset(editableElement, cursorOffset);
        }
      }, 0);
    } else if (needsRerenderOnInput) {
      // Block type didn't change, but content needs DOM update
      // Update just this block's DOM without clearing the whole editor
      this.updateBlockDOM(block, blockElement, cursorOffset);
    }

    // Trigger onChange
    this.triggerChange("content");
  }

  /**
   * Update a single block's DOM without full re-render
   * This prevents flickering and maintains scroll position
   */
  private updateBlockDOM(
    block: Block,
    blockElement: HTMLElement,
    cursorOffset: number,
  ): void {
    const plugin = this.blockPlugins.get(block.type);
    if (!plugin) return;

    // Render the updated block
    const newElement = plugin.renderActive(block, cursorOffset);
    newElement.setAttribute("data-block-id", block.id);

    // Replace the block element's content (not the element itself)
    // This preserves the element's position in the DOM and avoids scroll jumps
    blockElement.className = newElement.className;
    blockElement.innerHTML = "";
    while (newElement.firstChild) {
      blockElement.appendChild(newElement.firstChild);
    }

    // Restore cursor position
    const editableElement = this.getEditableElement(blockElement);
    if (editableElement) {
      this.setCursorAtOffset(editableElement, cursorOffset);
    }
  }

  /**
   * Get text content from block element, removing zero-width spaces used for structure preservation
   */
  private getBlockTextContent(element: HTMLElement): string {
    const text = element.textContent || "";
    return text.replace(new RegExp(ZERO_WIDTH_SPACE, "g"), "");
  }

  /**
   * Check if block content matches any block matchers and auto-convert
   * Updates block type/metadata but does NOT render - caller is responsible for rendering
   */
  private checkBlockMatchers(block: Block, text: string): void {
    let bestMatch: { plugin: BlockPlugin; result: BlockMatchResult } | null =
      null;

    for (const [pluginId, plugin] of this.blockPlugins.entries()) {
      if (!plugin.matcher) continue;

      const matchResult = plugin.matcher(text, 0);
      if (matchResult) {
        bestMatch = { plugin, result: matchResult };
        break;
      }
    }

    if (bestMatch) {
      const { plugin, result } = bestMatch;
      block.type = result.type;
      if (result.metadata) {
        block.metadata = { ...result.metadata };
      }
      block.content = text;
    } else {
      block.type = "paragraph";
      block.metadata = {};
    }
  }

  /**
   * Get Range from a point (x, y coordinates)
   */
  private getRangeFromPoint(x: number, y: number): Range | null {
    if (document.caretRangeFromPoint) {
      return document.caretRangeFromPoint(x, y);
    } else if ((document as any).caretPositionFromPoint) {
      const position = (document as any).caretPositionFromPoint(x, y);
      if (position) {
        const range = document.createRange();
        range.setStart(position.offsetNode, position.offset);
        range.collapse(true);
        return range;
      }
    }
    return null;
  }

  /**
   * Find the last text node in an element
   */
  private findLastTextNode(element: HTMLElement): Text | null {
    const walk = (node: Node): Text | null => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node as Text;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        // Walk children in reverse to find last text node
        const children = Array.from(node.childNodes);
        for (let i = children.length - 1; i >= 0; i--) {
          const result = walk(children[i]);
          if (result) return result;
        }
      }

      return null;
    };

    return walk(element);
  }

  private handleMouseDown(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target) return;

    const blockElement = this.getBlockElementFromTarget(target);
    if (!blockElement) return;

    const blockId = blockElement.getAttribute("data-block-id");
    if (!blockId) return;

    const block = BlockTree.findBlockById(this.root, blockId);
    if (!block) return;

    // If block is already active, let browser handle click naturally
    if (block.isActive) {
      return;
    }

    // Prevent default to stop browser from setting focus on the old (inactive) element
    e.preventDefault();

    // Store click coordinates for cursor positioning after render
    const clickX = e.clientX;
    const clickY = e.clientY;

    // Activate the block
    const allBlocks = BlockTree.getAllBlocks(this.root);
    allBlocks.forEach((b) => (b.isActive = false));
    block.isActive = true;

    // Re-render to show active state
    this.render();

    // Focus the newly rendered element and position cursor at click location
    const newBlockElement = this.editorElement?.querySelector(
      `[data-block-id="${blockId}"]`,
    ) as HTMLElement;
    const newEditableElement = newBlockElement
      ? this.getEditableElement(newBlockElement)
      : null;
    if (newEditableElement) {
      newEditableElement.focus();

      // Use document.caretRangeFromPoint to position cursor at click location
      const range = this.getRangeFromPoint(clickX, clickY);
      if (range) {
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    if (!target) return;

    const blockElement = this.getBlockElementFromTarget(target);
    if (!blockElement) return;

    const blockId = blockElement.getAttribute("data-block-id");
    if (!blockId) return;

    const block = BlockTree.findBlockById(this.root, blockId);
    if (!block) return;

    // Get the editable element (which is the actual event target)
    const editableElement = this.getEditableElement(blockElement);
    if (!editableElement) return;

    if (e.key === "Enter") {
      e.preventDefault();

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      const range = sel.getRangeAt(0);
      const cursorOffset = this.getCursorOffsetInBlock(range, editableElement);

      const plugin = this.blockPlugins.get(block.type);

      const isListBlock = block.type === "ul" || block.type === "ol";
      let isEmpty = false;
      if (isListBlock && plugin) {
        const content = plugin.extractContent(block);
        isEmpty = content.trim() === "";
      }

      if (isListBlock && isEmpty) {
        const parent = this.findParentBlock(block);

        if (parent) {
          this.unindentBlock(block);

          this.render();

          setTimeout(() => {
            const blockElement = this.editorElement?.querySelector(
              `[data-block-id="${block.id}"]`,
            ) as HTMLElement;
            const editableElement = blockElement
              ? this.getEditableElement(blockElement)
              : null;
            if (editableElement) {
              editableElement.focus();
              this.setCursorAtOffset(editableElement, 0);
            }
          }, 0);

          this.triggerChange("content");
          return;
        }

        block.type = "paragraph";
        block.content = "";
        block.metadata = {};
        block.isActive = true;

        this.render();

        setTimeout(() => {
          const blockElement = this.editorElement?.querySelector(
            `[data-block-id="${block.id}"]`,
          ) as HTMLElement;
          const editableElement = blockElement
            ? this.getEditableElement(blockElement)
            : null;
          if (editableElement) {
            editableElement.focus();
            this.setCursorAtOffset(editableElement, 0);
          }
        }, 0);

        this.triggerChange("content");
        return;
      }

      const syntaxLength = plugin ? plugin.getSyntaxLength(block) : 0;
      if (isListBlock && plugin && cursorOffset <= syntaxLength) {
        const previousBlock = this.findPreviousBlock(block);
        if (
          previousBlock &&
          (previousBlock.type === "ul" || previousBlock.type === "ol")
        ) {
          const prevPlugin = this.blockPlugins.get(previousBlock.type);
          if (prevPlugin) {
            const prevContent = prevPlugin.extractContent(previousBlock);
            if (prevContent.trim() === "") {
              this.removeBlockFromTree(previousBlock);

              const currentContent = plugin.extractContent(block);
              block.content = currentContent;

              this.checkBlockMatchers(block, currentContent);
              block.isActive = true;

              this.render();

              setTimeout(() => {
                const blockElement = this.editorElement?.querySelector(
                  `[data-block-id="${block.id}"]`,
                ) as HTMLElement;
                const editableElement = blockElement
                  ? this.getEditableElement(blockElement)
                  : null;
                if (editableElement) {
                  editableElement.focus();
                  this.setCursorAtOffset(editableElement, 0);
                }
              }, 0);

              this.triggerChange("content");
              return;
            }
          }
        }
      }

      let currentBlock: Block;
      let newBlock: Block;

      if (plugin && plugin.onSplit) {
        [currentBlock, newBlock] = plugin.onSplit(block, cursorOffset);
        Object.assign(block, currentBlock);
      } else {
        newBlock = BlockTree.createBlock("paragraph", "");
      }

      this.checkBlockMatchers(newBlock, newBlock.content);

      newBlock.isActive = true;
      block.isActive = false;

      BlockTree.insertAfter(block, newBlock);

      this.render();

      setTimeout(() => {
        const newBlockElement = this.editorElement?.querySelector(
          `[data-block-id="${newBlock.id}"]`,
        ) as HTMLElement;
        const editableElement = newBlockElement
          ? this.getEditableElement(newBlockElement)
          : null;
        if (editableElement) {
          editableElement.focus();

          const newBlockPlugin = this.blockPlugins.get(newBlock.type);
          if (newBlockPlugin) {
            newBlockPlugin.positionCursorAfterCreate(editableElement);
          } else {
            this.setCursorAtOffset(editableElement, 0);
          }
        }
      }, 0);

      this.triggerChange("content");
    }

    if (e.key === "ArrowUp") {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      const range = sel.getRangeAt(0);

      // Check if we're at the first visual line
      if (!this.isAtFirstVisualLine(editableElement, range)) {
        // Not at first line, let browser handle navigation within the block
        return;
      }

      // At first line, navigate to previous block
      e.preventDefault();

      // Store horizontal X position for vertical navigation
      const cursorX = this.getCursorXPosition(range);

      const previousBlock = this.findPreviousBlock(block);
      if (previousBlock) {
        this.focusBlockAtXPosition(previousBlock, cursorX, true); // true = position at last line
      }
    }

    if (e.key === "ArrowDown") {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      const range = sel.getRangeAt(0);

      // Check if we're at the last visual line
      if (!this.isAtLastVisualLine(editableElement, range)) {
        // Not at last line, let browser handle navigation within the block
        return;
      }

      // At last line, navigate to next block
      e.preventDefault();

      // Store horizontal X position for vertical navigation
      const cursorX = this.getCursorXPosition(range);

      const nextBlock =
        block.child || block.next || this.findNextBlockInTree(block);
      if (nextBlock) {
        this.focusBlockAtXPosition(nextBlock, cursorX, false); // false = position at first line
      }
    }

    if (e.key === "Backspace") {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      const range = sel.getRangeAt(0);
      const cursorOffset = this.getCursorOffsetInBlock(range, editableElement);

      if (cursorOffset === 0) {
        e.preventDefault();

        const previousBlock = this.findPreviousBlock(block);
        if (previousBlock) {
          const previousFullLength = previousBlock.content.length;

          const currentPlugin = this.blockPlugins.get(block.type);
          const previousPlugin = this.blockPlugins.get(previousBlock.type);

          const currentContent = currentPlugin
            ? currentPlugin.extractContent(block)
            : block.content;
          const previousContent = previousPlugin
            ? previousPlugin.extractContent(previousBlock)
            : previousBlock.content;

          previousBlock.content = previousPlugin
            ? previousPlugin.reconstructContent(
                previousContent + currentContent,
                previousBlock.metadata,
              )
            : previousContent + currentContent;

          previousBlock.isActive = true;

          this.removeBlockFromTree(block);

          this.render();

          setTimeout(() => {
            const prevBlockElement = this.editorElement?.querySelector(
              `[data-block-id="${previousBlock.id}"]`,
            ) as HTMLElement;
            const editableElement = prevBlockElement
              ? this.getEditableElement(prevBlockElement)
              : null;
            if (editableElement) {
              editableElement.focus();
              this.setCursorAtOffset(editableElement, previousFullLength);
            }
          }, 0);

          this.triggerChange("content");
        }
      }
    }

    if (e.key === "Delete") {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      const range = sel.getRangeAt(0);
      const cursorOffset = this.getCursorOffsetInBlock(range, editableElement);

      const blockFullLength = block.content.length;
      if (cursorOffset === blockFullLength) {
        e.preventDefault();

        const nextBlock =
          block.child || block.next || this.findNextBlockInTree(block);
        if (nextBlock) {
          const currentFullLength = block.content.length;

          const currentPlugin = this.blockPlugins.get(block.type);
          const nextPlugin = this.blockPlugins.get(nextBlock.type);

          const nextContent = nextPlugin
            ? nextPlugin.extractContent(nextBlock)
            : nextBlock.content;
          const currentContent = currentPlugin
            ? currentPlugin.extractContent(block)
            : block.content;

          block.content = currentPlugin
            ? currentPlugin.reconstructContent(
                currentContent + nextContent,
                block.metadata,
              )
            : currentContent + nextContent;

          block.isActive = true;

          this.removeBlockFromTree(nextBlock);

          this.render();

          setTimeout(() => {
            const currentBlockElement = this.editorElement?.querySelector(
              `[data-block-id="${block.id}"]`,
            ) as HTMLElement;
            const editableElement = currentBlockElement
              ? this.getEditableElement(currentBlockElement)
              : null;
            if (editableElement) {
              editableElement.focus();
              this.setCursorAtOffset(editableElement, currentFullLength);
            }
          }, 0);

          this.triggerChange("content");
        }
      }
    }

    if (e.key === "Tab") {
      // Check if current block is a list item
      const isListBlock = block.type === "ul" || block.type === "ol";
      if (isListBlock) {
        e.preventDefault();

        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;

        const range = sel.getRangeAt(0);
        const cursorOffset = this.getCursorOffsetInBlock(
          range,
          editableElement,
        );

        if (e.shiftKey) {
          const parent = this.findParentBlock(block);
          if (parent) {
            this.unindentBlock(block);

            this.render();

            setTimeout(() => {
              const blockElement = this.editorElement?.querySelector(
                `[data-block-id="${block.id}"]`,
              ) as HTMLElement;
              const editableElement = blockElement
                ? this.getEditableElement(blockElement)
                : null;
              if (editableElement) {
                editableElement.focus();
                this.setCursorAtOffset(editableElement, cursorOffset);
              }
            }, 0);

            this.triggerChange("content");
          }
        } else {
          const previousSibling = this.findPreviousSibling(block);

          if (
            previousSibling &&
            (previousSibling.type === "ul" || previousSibling.type === "ol")
          ) {
            this.removeBlockFromTree(block);

            if (previousSibling.child) {
              let lastChild = previousSibling.child;
              while (lastChild.next) {
                lastChild = lastChild.next;
              }
              lastChild.next = block;
              block.next = null;
            } else {
              previousSibling.child = block;
              block.next = null;
            }

            block.isActive = true;

            this.render();

            setTimeout(() => {
              const blockElement = this.editorElement?.querySelector(
                `[data-block-id="${block.id}"]`,
              ) as HTMLElement;
              const editableElement = blockElement
                ? this.getEditableElement(blockElement)
                : null;
              if (editableElement) {
                editableElement.focus();
                this.setCursorAtOffset(editableElement, cursorOffset);
              }
            }, 0);

            this.triggerChange("content");
          }
        }
      }
    }
  }

  /**
   * Get the block element from an event target
   * If target is a content wrapper, returns the parent block element
   */
  private getBlockElementFromTarget(target: HTMLElement): HTMLElement | null {
    // Check if target itself has data-block-id
    if (target.hasAttribute("data-block-id")) {
      return target;
    }
    // Otherwise traverse up to find the block element
    let element = target.parentElement;
    while (element) {
      if (element.hasAttribute("data-block-id")) {
        return element;
      }
      element = element.parentElement;
    }
    return null;
  }

  /**
   * Get the editable element within a block
   * For list items, this is the content wrapper; for other blocks, the block itself
   */
  private getEditableElement(blockElement: HTMLElement): HTMLElement | null {
    if (blockElement.contentEditable === "true") {
      return blockElement;
    }
    // Look for content wrapper with contentEditable
    const editableChild = blockElement.querySelector(
      '[contenteditable="true"]',
    ) as HTMLElement;
    return editableChild || null;
  }

  /**
   * Get the bounding rect of the actual text content (excluding child blocks)
   */
  private getContentBoundingRect(element: HTMLElement): DOMRect | null {
    // Create a range that covers all text nodes in the element (excluding child block containers)
    const range = document.createRange();
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        // Skip text nodes that are inside child block containers
        let parent = node.parentElement;
        while (parent && parent !== element) {
          if (parent.classList.contains("md-block-children")) {
            return NodeFilter.FILTER_REJECT;
          }
          parent = parent.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let firstNode: Node | null = null;
    let lastNode: Node | null = null;
    let node = walker.nextNode();

    while (node) {
      if (!firstNode) firstNode = node;
      lastNode = node;
      node = walker.nextNode();
    }

    if (!firstNode || !lastNode) {
      return null;
    }

    try {
      range.setStartBefore(firstNode);
      range.setEndAfter(lastNode);
      return range.getBoundingClientRect();
    } catch (e) {
      return null;
    }
  }

  /**
   * Check if cursor is at the first visual line of an element
   * Returns true if moving up would exit the element bounds
   */
  private isAtFirstVisualLine(element: HTMLElement, range: Range): boolean {
    const cursorRect = range.getBoundingClientRect();
    const contentRect = this.getContentBoundingRect(element);

    if (!contentRect) {
      return true; // If we can't determine, assume we're at the boundary
    }

    // Calculate line height from computed style
    const computedStyle = window.getComputedStyle(element);
    const lineHeight = parseFloat(computedStyle.lineHeight) || 20;

    // Check if cursor is within the first line of actual content
    const tolerance = lineHeight / 2;
    return cursorRect.top - contentRect.top <= tolerance;
  }

  /**
   * Check if cursor is at the last visual line of an element
   * Returns true if moving down would exit the element bounds
   */
  private isAtLastVisualLine(element: HTMLElement, range: Range): boolean {
    const cursorRect = range.getBoundingClientRect();
    const contentRect = this.getContentBoundingRect(element);

    if (!contentRect) {
      return true; // If we can't determine, assume we're at the boundary
    }

    // Calculate line height from computed style
    const computedStyle = window.getComputedStyle(element);
    const lineHeight = parseFloat(computedStyle.lineHeight) || 20;

    // Check if cursor is within the last line of actual content
    const tolerance = lineHeight / 2;
    return contentRect.bottom - cursorRect.bottom <= tolerance;
  }

  /**
   * Get the horizontal X position of the cursor
   */
  private getCursorXPosition(range: Range): number {
    const rect = range.getBoundingClientRect();
    return rect.left;
  }

  /**
   * Position cursor at a specific X coordinate within an element
   * If atEnd is true, positions at the last line; otherwise at the first line
   */
  private setCursorAtXPosition(
    element: HTMLElement,
    targetX: number,
    atEnd: boolean,
  ): void {
    const range = document.createRange();
    const sel = window.getSelection();

    // Get all text nodes in the element (excluding child block containers)
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        // Skip text nodes that are inside child block containers
        let parent = node.parentElement;
        while (parent && parent !== element) {
          if (parent.classList.contains("md-block-children")) {
            return NodeFilter.FILTER_REJECT;
          }
          parent = parent.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const textNodes: Text[] = [];
    let node = walker.nextNode() as Text | null;
    while (node) {
      textNodes.push(node);
      node = walker.nextNode() as Text | null;
    }

    if (textNodes.length === 0) {
      // No text nodes, position at start
      range.setStart(element, 0);
      range.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(range);
      return;
    }

    // Create ranges for each character position and find the closest to targetX on the appropriate line
    let bestNode: Text | null = null;
    let bestOffset = 0;
    let bestDistance = Infinity;
    let targetY: number | null = null;

    // First pass: determine target Y position (first or last line)
    for (const textNode of textNodes) {
      const text = textNode.textContent || "";
      for (let i = 0; i <= text.length; i++) {
        try {
          range.setStart(textNode, i);
          range.collapse(true);
          const rect = range.getBoundingClientRect();

          if (atEnd) {
            // Find the maximum Y (last line)
            if (targetY === null || rect.top > targetY) {
              targetY = rect.top;
            }
          } else {
            // Find the minimum Y (first line)
            if (targetY === null || rect.top < targetY) {
              targetY = rect.top;
            }
          }
        } catch (e) {
          // Ignore errors
        }
      }
    }

    // If we couldn't find a target Y, bail out
    if (targetY === null) {
      return;
    }

    // Second pass: find closest X position on the target line
    const lineHeightTolerance = 5; // Pixels tolerance for same line
    for (const textNode of textNodes) {
      const text = textNode.textContent || "";
      for (let i = 0; i <= text.length; i++) {
        try {
          range.setStart(textNode, i);
          range.collapse(true);
          const rect = range.getBoundingClientRect();

          // Check if this position is on the target line
          if (Math.abs(rect.top - targetY) <= lineHeightTolerance) {
            const distance = Math.abs(rect.left - targetX);
            if (distance < bestDistance) {
              bestDistance = distance;
              bestNode = textNode;
              bestOffset = i;
            }
          }
        } catch (e) {
          // Ignore errors
        }
      }
    }

    // Set cursor at the best position found
    if (bestNode) {
      range.setStart(bestNode, bestOffset);
      range.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }

  /**
   * Get cursor offset from the start of the entire editable block
   *
   * Uses TreeWalker to traverse all text nodes in the block element and calculate
   * the absolute character position of the cursor from the start of the block.
   * This accounts for multiple text nodes created by syntax/content spans.
   */
  private getCursorOffsetInBlock(
    range: Range,
    blockElement?: HTMLElement,
  ): number {
    if (!blockElement) {
      const node = range.startContainer;
      const nodeOffset = range.startOffset;
      if (node.nodeType === Node.TEXT_NODE) {
        return nodeOffset;
      }
      return 0;
    }

    let offset = 0;
    const walker = document.createTreeWalker(
      blockElement,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Skip text nodes that are inside child block containers
          let parent = node.parentElement;
          while (parent && parent !== blockElement) {
            if (parent.classList.contains("md-block-children")) {
              return NodeFilter.FILTER_REJECT;
            }
            parent = parent.parentElement;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );

    let currentNode = walker.nextNode();
    while (currentNode) {
      if (currentNode === range.startContainer) {
        offset += range.startOffset;
        break;
      } else {
        offset += currentNode.textContent?.length || 0;
      }
      currentNode = walker.nextNode();
    }

    return offset;
  }

  /**
   * Focus a block and place cursor at specific character offset from start of block
   */
  private focusBlockAtOffset(block: Block, targetOffset: number): void {
    // Activate the block
    const allBlocks = BlockTree.getAllBlocks(this.root);
    allBlocks.forEach((b) => (b.isActive = false));
    block.isActive = true;

    // Re-render
    this.render();

    // Focus and position cursor
    setTimeout(() => {
      const blockElement = this.editorElement?.querySelector(
        `[data-block-id="${block.id}"]`,
      ) as HTMLElement;
      const editableElement = blockElement
        ? this.getEditableElement(blockElement)
        : null;
      if (editableElement) {
        editableElement.focus();

        // Set cursor at the target offset from the start of the block
        this.setCursorAtOffset(blockElement, targetOffset);
      }
    }, 0);
  }

  /**
   * Focus a block and place cursor at specific X coordinate
   * If atEnd is true, positions at the last line; otherwise at the first line
   */
  private focusBlockAtXPosition(
    block: Block,
    targetX: number,
    atEnd: boolean,
  ): void {
    // Activate the block
    const allBlocks = BlockTree.getAllBlocks(this.root);
    allBlocks.forEach((b) => (b.isActive = false));
    block.isActive = true;

    // Re-render
    this.render();

    // Focus and position cursor
    setTimeout(() => {
      const blockElement = this.editorElement?.querySelector(
        `[data-block-id="${block.id}"]`,
      ) as HTMLElement;
      const editableElement = blockElement
        ? this.getEditableElement(blockElement)
        : null;
      if (editableElement) {
        editableElement.focus();

        // Set cursor at the target X position on the appropriate line
        this.setCursorAtXPosition(blockElement, targetX, atEnd);
      }
    }, 0);
  }

  /**
   * Set cursor at a specific offset from the start of an element
   *
   * Uses TreeWalker to traverse text nodes and find the correct position for the cursor.
   * Accumulates character counts across nodes until reaching the target offset,
   * then places the cursor within the appropriate text node.
   */
  private setCursorAtOffset(element: HTMLElement, targetOffset: number): void {
    const range = document.createRange();
    const sel = window.getSelection();

    let currentOffset = 0;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        // Skip text nodes that are inside child block containers
        let parent = node.parentElement;
        while (parent && parent !== element) {
          if (parent.classList.contains("md-block-children")) {
            return NodeFilter.FILTER_REJECT;
          }
          parent = parent.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let textNode = walker.nextNode() as Text | null;
    while (textNode) {
      const nodeLength = textNode.textContent?.length || 0;

      if (currentOffset + nodeLength >= targetOffset) {
        const offsetInNode = targetOffset - currentOffset;
        range.setStart(textNode, offsetInNode);
        range.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(range);
        return;
      }

      currentOffset += nodeLength;
      textNode = walker.nextNode() as Text | null;
    }

    const lastTextNode = this.findLastTextNode(element);
    if (lastTextNode) {
      range.setStart(lastTextNode, lastTextNode.textContent?.length || 0);
      range.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }

  /**
   * Remove a block from the tree
   *
   * Recursively searches the block tree (traversing both child and next pointers)
   * to find the block to remove. When found, re-links the tree structure to
   * bypass the removed block, maintaining the tree's integrity.
   */
  private removeBlockFromTree(blockToRemove: Block): void {
    if (!this.root) return;

    if (this.root === blockToRemove) {
      this.root = blockToRemove.next;
      return;
    }

    const removeFromChain = (
      parent: Block | null,
      current: Block | null,
    ): boolean => {
      if (!current) return false;

      if (current.child === blockToRemove) {
        current.child = blockToRemove.next;
        return true;
      }

      if (current.next === blockToRemove) {
        current.next = blockToRemove.next;
        return true;
      }

      if (removeFromChain(current, current.child)) return true;
      if (removeFromChain(current, current.next)) return true;

      return false;
    };

    removeFromChain(null, this.root);
  }

  /**
   * Find previous block in the tree
   */
  private findPreviousBlock(currentBlock: Block): Block | null {
    const allBlocks = BlockTree.getAllBlocks(this.root);
    const currentIndex = allBlocks.indexOf(currentBlock);

    if (currentIndex > 0) {
      return allBlocks[currentIndex - 1];
    }

    return null;
  }

  /**
   * Find previous sibling at the same hierarchical level
   * This is different from findPreviousBlock which returns the previous block in traversal order
   */
  private findPreviousSibling(currentBlock: Block): Block | null {
    // First, find the parent of currentBlock
    const parent = this.findParentBlock(currentBlock);

    if (!parent) {
      // currentBlock is at root level
      // Check if root is currentBlock
      if (this.root === currentBlock) return null;

      // Find previous sibling at root level
      let prev: Block | null = this.root;
      while (prev && prev.next !== currentBlock) {
        prev = prev.next;
      }
      return prev;
    } else {
      // currentBlock is a child of parent
      // Find previous sibling in parent's child chain
      if (parent.child === currentBlock) return null;

      let prev: Block | null = parent.child;
      while (prev && prev.next !== currentBlock) {
        prev = prev.next;
      }
      return prev;
    }
  }

  /**
   * Unindent a block by moving it from being a child to being a sibling of its parent
   */
  private unindentBlock(block: Block): void {
    const parent = this.findParentBlock(block);
    if (!parent) return;

    if (parent.child === block) {
      parent.child = block.next;
    } else {
      let prevSibling: Block | null = parent.child;
      while (prevSibling && prevSibling.next !== block) {
        prevSibling = prevSibling.next;
      }
      if (prevSibling) {
        prevSibling.next = block.next;
      }
    }

    block.next = parent.next;
    parent.next = block;
  }

  /**
   * Find the parent block of a given block
   */
  private findParentBlock(targetBlock: Block): Block | null {
    const searchParent = (
      current: Block | null,
      target: Block,
    ): Block | null => {
      if (!current) return null;

      // Check if target is a direct child
      if (current.child === target) return current;

      // Check if target is in the child chain
      if (current.child) {
        let child: Block | null = current.child;
        while (child) {
          if (child === target) return current;
          child = child.next;
        }
      }

      // Recurse into child subtree
      if (current.child) {
        const foundInChild = searchParent(current.child, target);
        if (foundInChild) return foundInChild;
      }

      // Recurse into next siblings
      if (current.next) {
        const foundInNext = searchParent(current.next, target);
        if (foundInNext) return foundInNext;
      }

      return null;
    };

    return searchParent(this.root, targetBlock);
  }

  /**
   * Find next block in tree traversal order
   */
  private findNextBlockInTree(currentBlock: Block): Block | null {
    const allBlocks = BlockTree.getAllBlocks(this.root);
    const currentIndex = allBlocks.indexOf(currentBlock);

    if (currentIndex >= 0 && currentIndex < allBlocks.length - 1) {
      return allBlocks[currentIndex + 1];
    }

    return null;
  }

  /**
   * Set a block as active
   */
  private setActiveBlock(blockId: string): void {
    const allBlocks = BlockTree.getAllBlocks(this.root);
    const block = BlockTree.findBlockById(this.root, blockId);

    if (!block) return;

    // Check if this block is already active
    if (block.isActive) {
      // Block is already active, don't interfere with cursor position
      return;
    }

    // Store current cursor position if there's a selection
    const sel = window.getSelection();
    let savedRange: Range | null = null;
    if (sel && sel.rangeCount > 0) {
      savedRange = sel.getRangeAt(0).cloneRange();
    }

    // Deactivate all blocks
    allBlocks.forEach((b) => (b.isActive = false));

    // Activate the target block
    block.isActive = true;

    // Re-render
    this.render();

    // Restore focus and cursor position
    setTimeout(() => {
      const blockElement = this.editorElement?.querySelector(
        `[data-block-id="${blockId}"]`,
      ) as HTMLElement;
      const editableElement = blockElement
        ? this.getEditableElement(blockElement)
        : null;
      if (editableElement) {
        editableElement.focus();

        // Try to restore the saved cursor position
        // Since we re-rendered, we can't use the exact saved range,
        // but the browser should maintain the click position naturally
        // after focus() is called
      }
    }, 0);
  }

  /**
   * Render the editor content
   */
  private render(): void {
    if (!this.editorElement) return;

    // Clear existing content
    this.editorElement.innerHTML = "";

    // Render blocks
    if (this.root) {
      this.renderBlock(this.root, this.editorElement);
    }
  }

  /**
   * Render a single block and its children
   */
  private renderBlock(block: Block | null, container: HTMLElement): void {
    if (!block) return;

    // Check if this is a list item that should be grouped
    if (block.type === "ul" || block.type === "ol") {
      this.renderListGroup(block, container);
      return;
    }

    // Regular block rendering
    const plugin = this.blockPlugins.get(block.type);
    if (!plugin) {
      console.warn(`No plugin found for block type: ${block.type}`);
      // Move to next block
      if (block.next) {
        this.renderBlock(block.next, container);
      }
      return;
    }

    // Render the block
    const element = block.isActive
      ? plugin.renderActive(block, 0)
      : plugin.renderInactive(block);

    // Add block ID as data attribute
    element.setAttribute("data-block-id", block.id);

    container.appendChild(element);

    // Render child blocks
    if (block.child) {
      const childContainer = document.createElement("div");
      childContainer.className = "md-block-children";
      this.renderBlock(block.child, childContainer);
      container.appendChild(childContainer);
    }

    // Render next blocks
    if (block.next) {
      this.renderBlock(block.next, container);
    }
  }

  /**
   * Render a group of consecutive list items of the same type
   * Groups consecutive ul or ol blocks into proper <ul> or <ol> containers
   */
  private renderListGroup(startBlock: Block, container: HTMLElement): void {
    const listType = startBlock.type;

    // Create the list container
    const listContainer = document.createElement(listType);
    listContainer.className = "md-list";

    let currentBlock: Block | null = startBlock;
    let lastRenderedBlock: Block | null = null;

    // Render consecutive list items of the same type
    while (currentBlock && currentBlock.type === listType) {
      const plugin = this.blockPlugins.get(currentBlock.type);
      if (!plugin) {
        console.warn(`No plugin found for block type: ${currentBlock.type}`);
        currentBlock = currentBlock.next;
        continue;
      }

      // Render the list item
      const element = currentBlock.isActive
        ? plugin.renderActive(currentBlock, 0)
        : plugin.renderInactive(currentBlock);

      // Add block ID as data attribute
      element.setAttribute("data-block-id", currentBlock.id);

      listContainer.appendChild(element);

      // Render child blocks (nested lists, etc.)
      if (currentBlock.child) {
        const childContainer = document.createElement("div");
        childContainer.className = "md-block-children";
        this.renderBlock(currentBlock.child, childContainer);
        element.appendChild(childContainer);
      }

      lastRenderedBlock = currentBlock;
      currentBlock = currentBlock.next;
    }

    // Add the list container to the main container
    container.appendChild(listContainer);

    // Continue rendering remaining blocks
    if (currentBlock) {
      this.renderBlock(currentBlock, container);
    }
  }

  /**
   * Load markdown text into editor
   */
  private loadMarkdown(markdown: string): void {
    const lines = markdown.split("\n");

    // Stack to track the last block at each indentation level
    // Index 0 = root level, index 1 = first indent level, etc.
    const blockStack: (Block | null)[] = [];

    for (const line of lines) {
      if (line.trim() === "") continue;

      // Calculate indentation level (2 spaces = 1 level)
      const indentMatch = line.match(/^(\s*)/);
      const indentSpaces = indentMatch ? indentMatch[1].length : 0;
      const depth = Math.floor(indentSpaces / 2);

      // Remove leading spaces from the line for parsing
      const trimmedLine = line.trim();

      // Try to parse the line using block plugins
      let block: Block | null = null;

      // Try each plugin's parser
      for (const [pluginId, plugin] of this.blockPlugins.entries()) {
        if (!plugin.matcher) continue;

        const matchResult = plugin.matcher(trimmedLine, 0);
        if (matchResult) {
          // Use the plugin's parse method to get metadata
          const blockData = plugin.parse(trimmedLine);
          // Store the trimmed line as content (without leading spaces)
          block = BlockTree.createBlock(
            blockData.type,
            trimmedLine,
            blockData.metadata || {},
          );
          break;
        }
      }

      // If no plugin matched, create a paragraph block
      if (!block) {
        block = BlockTree.createBlock("paragraph", trimmedLine);
      }

      // Add block to the tree based on depth
      if (depth === 0) {
        // Root level block
        if (!this.root) {
          this.root = block;
          blockStack[0] = block;
        } else {
          // Add as next sibling to the last root-level block
          const lastRootBlock = blockStack[0];
          if (lastRootBlock) {
            lastRootBlock.next = block;
          }
          blockStack[0] = block;
        }
        // Clear deeper levels when we return to root
        blockStack.length = 1;
      } else {
        // Nested block - add as child of parent at depth-1
        const parentBlock = blockStack[depth - 1];
        if (parentBlock) {
          if (!parentBlock.child) {
            // First child
            parentBlock.child = block;
          } else {
            // Add as next sibling to last child at this level
            const lastSibling = blockStack[depth];
            if (lastSibling) {
              lastSibling.next = block;
            }
          }
          blockStack[depth] = block;
          // Clear deeper levels
          blockStack.length = depth + 1;
        }
      }
    }

    // If still no root, create empty paragraph
    if (!this.root) {
      this.root = BlockTree.createBlock("paragraph", "");
    }
  }

  /**
   * Trigger onChange callback
   */
  private triggerChange(type: "content" | "cursor" | "selection"): void {
    if (this.config.onChange) {
      const event: ChangeEvent = {
        type,
        timestamp: Date.now(),
      };
      this.config.onChange(this, event);
    }
  }

  /**
   * Save editor content as markdown string
   */
  async save(): Promise<string> {
    if (!this.root) return "";

    const lines: string[] = [];
    this.serializeBlock(this.root, lines, 0, null);

    return lines.join("\n");
  }

  /**
   * Recursively serialize a block and its siblings/children with proper indentation
   */
  private serializeBlock(
    block: Block | null,
    lines: string[],
    depth: number,
    prevBlockType: string | null,
  ): string | null {
    if (!block) return prevBlockType;

    const plugin = this.blockPlugins.get(block.type);
    if (plugin) {
      const markdown = plugin.serialize(block);
      if (markdown) {
        // Use plugin's shouldAddEmptyLineBefore to determine spacing
        if (plugin.shouldAddEmptyLineBefore(prevBlockType)) {
          lines.push(""); // Add empty line
        }

        // Add indentation for nested blocks (2 spaces per level)
        const indent = "  ".repeat(depth);
        lines.push(indent + markdown);
        prevBlockType = block.type;
      }
    }

    // Serialize children (with increased depth)
    if (block.child) {
      prevBlockType = this.serializeBlock(
        block.child,
        lines,
        depth + 1,
        prevBlockType,
      );
    }

    // Serialize next sibling (at same depth)
    if (block.next) {
      prevBlockType = this.serializeBlock(
        block.next,
        lines,
        depth,
        prevBlockType,
      );
    }

    return prevBlockType;
  }

  /**
   * Load markdown into editor
   */
  async load(markdown: string): Promise<void> {
    this.root = null;
    this.loadMarkdown(markdown);
    this.render();
    this.triggerChange("content");
  }

  /**
   * Get current block tree
   */
  getBlocks(): Block[] {
    return BlockTree.getAllBlocks(this.root);
  }

  /**
   * Clear editor content
   */
  clear(): void {
    this.root = BlockTree.createBlock("paragraph", "");
    this.render();
    this.triggerChange("content");
  }

  /**
   * Destroy editor instance
   */
  destroy(): void {
    if (this.editorElement) {
      this.editorElement.remove();
      this.editorElement = null;
    }
    this.root = null;
  }

  /**
   * Focus editor
   */
  focus(): void {
    if (this.editorElement) {
      const firstBlock = this.editorElement.querySelector(
        "[data-block-id]",
      ) as HTMLElement;
      if (firstBlock) {
        firstBlock.focus();
      }
    }
  }

  /**
   * Check if editor is empty
   */
  isEmpty(): boolean {
    if (!this.root) return true;
    const blocks = BlockTree.getAllBlocks(this.root);
    return blocks.every((block) => !block.content.trim());
  }
}
