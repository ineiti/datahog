import { EditorConfig, ChangeEvent } from '../types/EditorConfig.js';
import { EditorAPI } from '../types/EditorAPI.js';
import { Block } from '../types/Block.js';
import { BlockTree } from './BlockTree.js';
import { BlockPlugin, BlockMatchResult } from '../types/BlockPlugin.js';

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

    // Get or find holder element
    if (typeof config.holder === 'string') {
      const element = document.getElementById(config.holder);
      if (!element) {
        throw new Error(`Element with id "${config.holder}" not found`);
      }
      this.holder = element;
    } else {
      this.holder = config.holder;
    }

    // Register block plugins
    if (config.tools.blocks) {
      for (const [name, blockConfig] of Object.entries(config.tools.blocks)) {
        this.blockPlugins.set(blockConfig.plugin.id, blockConfig.plugin);
      }
    }

    // Initialize editor
    this.initialize();
  }

  /**
   * Initialize the editor
   */
  private initialize(): void {
    // Create editor container
    this.editorElement = document.createElement('div');
    this.editorElement.className = 'md-editor';
    this.holder.appendChild(this.editorElement);

    // Load initial data
    if (this.config.data) {
      if (typeof this.config.data === 'string') {
        this.loadMarkdown(this.config.data);
      } else {
        // Load from block data
        if (this.config.data.blocks && this.config.data.blocks.length > 0) {
          this.root = BlockTree.fromData(this.config.data.blocks[0]);
        }
      }
    }

    // If no data, create empty paragraph
    if (!this.root) {
      this.root = BlockTree.createBlock('paragraph', '');
    }

    // Make first block active by default
    if (this.root) {
      this.root.isActive = true;
    }

    // Initial render
    this.render();

    // Setup event listeners
    this.setupEventListeners();

    // Focus the first block if autofocus is enabled
    if (this.config.autofocus !== false) {
      setTimeout(() => {
        const firstBlock = this.editorElement?.querySelector('[contenteditable="true"]') as HTMLElement;
        if (firstBlock) {
          firstBlock.focus();
        }
      }, 0);
    }

    // Call onReady callback
    if (this.config.onReady) {
      this.config.onReady(this);
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    if (!this.editorElement) return;

    // Listen for input events
    this.editorElement.addEventListener('input', (e) => {
      this.handleInput(e);
    });

    // Listen for mousedown events to track cursor position BEFORE render
    this.editorElement.addEventListener('mousedown', (e) => {
      this.handleMouseDown(e);
    });

    // Listen for keydown to handle Enter key and other special keys
    this.editorElement.addEventListener('keydown', (e) => {
      this.handleKeyDown(e);
    });
  }

  /**
   * Handle input events
   */
  private handleInput(e: Event): void {
    const target = e.target as HTMLElement;
    if (!target) return;

    // Find the block that was edited
    const blockId = target.getAttribute('data-block-id');
    if (!blockId) return;

    const block = BlockTree.findBlockById(this.root, blockId);
    if (!block) return;

    // Store cursor offset BEFORE getting new content
    const sel = window.getSelection();
    let cursorOffset = 0;
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      cursorOffset = this.getCursorOffsetInBlock(range, target);
    }

    // Get current text content
    const textContent = this.getBlockTextContent(target);
    block.content = textContent;

    // Check if block should be converted based on matchers
    // This will re-render if type changes
    this.checkBlockMatchers(block, textContent);

    // Always re-render to update syntax/content spans
    // (even if block type doesn't change, the syntax might have changed)
    this.render();

    // Restore cursor position
    setTimeout(() => {
      const blockElement = this.editorElement?.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement;
      if (blockElement && blockElement.contentEditable === 'true') {
        blockElement.focus();
        this.setCursorAtOffset(blockElement, cursorOffset);
      }
    }, 0);

    // Trigger onChange
    this.triggerChange('content');
  }

  /**
   * Get text content from block element
   * Since markdown syntax is now part of the editable text, we get all text content
   * Remove zero-width spaces used for preserving empty content spans
   */
  private getBlockTextContent(element: HTMLElement): string {
    const text = element.textContent || '';
    // Remove zero-width spaces (U+200B) used to preserve structure
    return text.replace(/\u200B/g, '');
  }

  /**
   * Check if block content matches any block matchers and auto-convert
   * Note: This only updates the block type/metadata, it does NOT render
   * The caller is responsible for rendering
   */
  private checkBlockMatchers(block: Block, text: string): void {
    let bestMatch: { plugin: BlockPlugin; result: BlockMatchResult } | null = null;

    // Try each registered block plugin's matcher to find the best match
    for (const [pluginId, plugin] of this.blockPlugins.entries()) {
      if (!plugin.matcher) continue;

      const matchResult = plugin.matcher(text, 0);
      if (matchResult) {
        bestMatch = { plugin, result: matchResult };
        break; // Take the first match
      }
    }

    // Check if we need to convert or update the block
    if (bestMatch) {
      const { plugin, result } = bestMatch;

      // Convert block type and update metadata if needed
      block.type = result.type;
      if (result.metadata) {
        block.metadata = { ...result.metadata };
      }

      // Keep the full text in block.content (don't strip syntax)
      // The block plugins will handle parsing it when rendering
      block.content = text;
    } else {
      // No match found - convert to paragraph if not already
      block.type = 'paragraph';
      block.metadata = {};
    }
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

  /**
   * Handle mousedown events to capture cursor position before render
   */
  private handleMouseDown(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target) return;

    // Find the block element (might be the target itself or a parent)
    let blockElement = target;
    while (blockElement && !blockElement.hasAttribute('data-block-id')) {
      blockElement = blockElement.parentElement as HTMLElement;
      if (!blockElement) return;
    }

    const blockId = blockElement.getAttribute('data-block-id');
    if (!blockId) return;

    const block = BlockTree.findBlockById(this.root, blockId);
    if (!block) return;

    // If block is already active, don't interfere
    if (block.isActive) {
      return;
    }

    // Store the mouse position to calculate cursor offset
    const clickX = e.clientX;
    const clickY = e.clientY;

    // Use setTimeout to let the browser place the cursor naturally first
    setTimeout(() => {
      // Activate the block
      const allBlocks = BlockTree.getAllBlocks(this.root);
      allBlocks.forEach(b => b.isActive = false);
      block.isActive = true;

      // Get cursor offset BEFORE re-render (from start of entire block)
      const sel = window.getSelection();
      let cursorOffset = 0;
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        cursorOffset = this.getCursorOffsetInBlock(range, blockElement);
      }

      // Re-render
      this.render();

      // Restore focus and cursor position
      setTimeout(() => {
        const activeElement = this.editorElement?.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement;
        if (activeElement && activeElement.contentEditable === 'true') {
          activeElement.focus();
          this.setCursorAtOffset(activeElement, cursorOffset);
        }
      }, 0);
    }, 0);
  }

  /**
   * Handle keydown events for special keys like Enter
   */
  private handleKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    if (!target) return;

    const blockId = target.getAttribute('data-block-id');
    if (!blockId) return;

    const block = BlockTree.findBlockById(this.root, blockId);
    if (!block) return;

    // Handle Enter key - split block using plugin's onSplit method
    if (e.key === 'Enter') {
      e.preventDefault();

      // Get cursor position
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      const range = sel.getRangeAt(0);
      const cursorOffset = this.getCursorOffsetInBlock(range, target);

      // Get the plugin for current block
      const plugin = this.blockPlugins.get(block.type);

      let currentBlock: Block;
      let newBlock: Block;

      if (plugin && plugin.onSplit) {
        // Use plugin's onSplit method to handle splitting
        [currentBlock, newBlock] = plugin.onSplit(block, cursorOffset);

        // Update the current block in the tree
        Object.assign(block, currentBlock);
      } else {
        // Fallback: create a new paragraph (default behavior)
        newBlock = BlockTree.createBlock('paragraph', '');
      }

      // Check if the new block's content should trigger auto-conversion to a different block type
      // (e.g., "# heading" should become a heading, not a paragraph)
      // Note: This works correctly for lists too - "- # heading" will match list matcher first
      this.checkBlockMatchers(newBlock, newBlock.content);

      // Set up block states
      newBlock.isActive = true;
      block.isActive = false;

      // Insert the new block after the current one
      BlockTree.insertAfter(block, newBlock);

      // Re-render
      this.render();

      // Focus the new block
      setTimeout(() => {
        const newBlockElement = this.editorElement?.querySelector(`[data-block-id="${newBlock.id}"]`) as HTMLElement;
        if (newBlockElement && newBlockElement.contentEditable === 'true') {
          newBlockElement.focus();

          // Place cursor based on block type
          if (newBlock.type === 'ul' || newBlock.type === 'ol') {
            // For list items, place cursor in the content span (after syntax)
            const contentSpan = newBlockElement.querySelector('.md-content');
            if (contentSpan) {
              const range = document.createRange();
              const sel = window.getSelection();

              if (contentSpan.firstChild && contentSpan.firstChild.nodeType === Node.TEXT_NODE) {
                range.setStart(contentSpan.firstChild, 0);
              } else {
                range.selectNodeContents(contentSpan);
              }
              range.collapse(true);
              sel?.removeAllRanges();
              sel?.addRange(range);
            }
          } else {
            // For other blocks (paragraph, heading), place cursor at start
            this.setCursorAtOffset(newBlockElement, 0);
          }
        }
      }, 0);

      this.triggerChange('content');
    }

    // Handle ArrowUp - move to previous block
    if (e.key === 'ArrowUp') {
      e.preventDefault();

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      // Get current cursor offset from start of block
      const range = sel.getRangeAt(0);
      const cursorOffset = this.getCursorOffsetInBlock(range, target);

      // Find previous block
      const previousBlock = this.findPreviousBlock(block);
      if (previousBlock) {
        this.focusBlockAtOffset(previousBlock, cursorOffset);
      }
    }

    // Handle ArrowDown - move to next block
    if (e.key === 'ArrowDown') {
      e.preventDefault();

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      // Get current cursor offset from start of block
      const range = sel.getRangeAt(0);
      const cursorOffset = this.getCursorOffsetInBlock(range, target);

      // Find next block (child first, then next sibling)
      const nextBlock = block.child || block.next || this.findNextBlockInTree(block);
      if (nextBlock) {
        this.focusBlockAtOffset(nextBlock, cursorOffset);
      }
    }

    // Handle Backspace at start of block - merge with previous block
    if (e.key === 'Backspace') {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      const range = sel.getRangeAt(0);
      const cursorOffset = this.getCursorOffsetInBlock(range, target);

      // Check if cursor is at the start of the block
      if (cursorOffset === 0) {
        e.preventDefault();

        // Find previous block
        const previousBlock = this.findPreviousBlock(block);
        if (previousBlock) {
          // Store the length of previous block content before merge
          // This is where the cursor should be positioned after merge
          const previousFullLength = previousBlock.content.length;

          // Merge: append current block's content to previous block
          // Extract content without syntax from both blocks
          const currentContent = this.extractContentWithoutSyntax(block);
          const previousContent = this.extractContentWithoutSyntax(previousBlock);

          // Merge the content
          previousBlock.content = this.reconstructBlockContent(
            previousBlock.type,
            previousBlock.metadata,
            previousContent + currentContent
          );

          // Activate the previous block so it renders as editable
          previousBlock.isActive = true;

          // Remove the current block from the tree
          this.removeBlockFromTree(block);

          // Re-render
          this.render();

          // Focus previous block at the merge point
          setTimeout(() => {
            const prevBlockElement = this.editorElement?.querySelector(`[data-block-id="${previousBlock.id}"]`) as HTMLElement;
            if (prevBlockElement && prevBlockElement.contentEditable === 'true') {
              prevBlockElement.focus();
              this.setCursorAtOffset(prevBlockElement, previousFullLength);
            }
          }, 0);

          this.triggerChange('content');
        }
      }
    }

    // Handle Delete at end of block - merge with next block
    if (e.key === 'Delete') {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      const range = sel.getRangeAt(0);
      const cursorOffset = this.getCursorOffsetInBlock(range, target);

      // Check if cursor is at the end of the block
      const blockFullLength = block.content.length;
      if (cursorOffset === blockFullLength) {
        e.preventDefault();

        // Find next block
        const nextBlock = block.child || block.next || this.findNextBlockInTree(block);
        if (nextBlock) {
          // Store the current cursor position (which is at the end of current block)
          // This is where the cursor should remain after merge
          const currentFullLength = block.content.length;

          // Merge: append next block's content to current block
          // Extract content without syntax from both blocks
          const nextContent = this.extractContentWithoutSyntax(nextBlock);
          const currentContent = this.extractContentWithoutSyntax(block);

          // Merge the content
          block.content = this.reconstructBlockContent(
            block.type,
            block.metadata,
            currentContent + nextContent
          );

          // Keep current block active
          block.isActive = true;

          // Remove the next block from the tree
          this.removeBlockFromTree(nextBlock);

          // Re-render
          this.render();

          // Focus current block at the original cursor position
          setTimeout(() => {
            const currentBlockElement = this.editorElement?.querySelector(`[data-block-id="${block.id}"]`) as HTMLElement;
            if (currentBlockElement && currentBlockElement.contentEditable === 'true') {
              currentBlockElement.focus();
              this.setCursorAtOffset(currentBlockElement, currentFullLength);
            }
          }, 0);

          this.triggerChange('content');
        }
      }
    }
  }

  /**
   * Get cursor offset from the start of the entire editable block
   */
  private getCursorOffsetInBlock(range: Range, blockElement?: HTMLElement): number {
    if (!blockElement) {
      // Fallback: just use the offset in the current text node
      const node = range.startContainer;
      const nodeOffset = range.startOffset;
      if (node.nodeType === Node.TEXT_NODE) {
        return nodeOffset;
      }
      return 0;
    }

    // Calculate offset from the start of the block element
    let offset = 0;
    const walker = document.createTreeWalker(
      blockElement,
      NodeFilter.SHOW_TEXT,
      null
    );

    let currentNode = walker.nextNode();
    while (currentNode) {
      if (currentNode === range.startContainer) {
        // Found the node containing the cursor
        offset += range.startOffset;
        break;
      } else {
        // Add the length of this text node
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
    allBlocks.forEach(b => b.isActive = false);
    block.isActive = true;

    // Re-render
    this.render();

    // Focus and position cursor
    setTimeout(() => {
      const blockElement = this.editorElement?.querySelector(`[data-block-id="${block.id}"]`) as HTMLElement;
      if (blockElement && blockElement.contentEditable === 'true') {
        blockElement.focus();

        // Set cursor at the target offset from the start of the block
        this.setCursorAtOffset(blockElement, targetOffset);
      }
    }, 0);
  }

  /**
   * Set cursor at a specific offset from the start of an element
   */
  private setCursorAtOffset(element: HTMLElement, targetOffset: number): void {
    const range = document.createRange();
    const sel = window.getSelection();

    // Walk through all text nodes to find the one containing the target offset
    let currentOffset = 0;
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null
    );

    let textNode = walker.nextNode() as Text | null;
    while (textNode) {
      const nodeLength = textNode.textContent?.length || 0;

      if (currentOffset + nodeLength >= targetOffset) {
        // The target offset is within this text node
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

    // If we didn't find the position, place cursor at the end
    const lastTextNode = this.findLastTextNode(element);
    if (lastTextNode) {
      range.setStart(lastTextNode, lastTextNode.textContent?.length || 0);
      range.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }

  /**
   * Extract content without markdown syntax from a block
   */
  private extractContentWithoutSyntax(block: Block): string {
    const text = block.content || '';

    // Try to match different block types and extract content
    if (block.type === 'heading') {
      const match = text.match(/^#{1,6}\s+(.*)$/);
      return match ? match[1] : text;
    } else if (block.type === 'ul') {
      const match = text.match(/^[-*]\s+(.*)$/);
      return match ? match[1] : text;
    } else if (block.type === 'ol') {
      const match = text.match(/^\d+\.\s+(.*)$/);
      return match ? match[1] : text;
    }

    // For paragraph or unknown types, return as-is
    return text;
  }

  /**
   * Reconstruct block content with proper syntax based on block type
   */
  private reconstructBlockContent(
    blockType: string,
    metadata: Record<string, any>,
    content: string
  ): string {
    if (blockType === 'heading') {
      const level = metadata.level || 1;
      return '#'.repeat(level) + ' ' + content;
    } else if (blockType === 'ul') {
      return '- ' + content;
    } else if (blockType === 'ol') {
      const number = metadata.number || 1;
      return number + '. ' + content;
    }

    // For paragraph, return content as-is
    return content;
  }

  /**
   * Get the length of syntax for a block type
   */
  private getSyntaxLength(blockType: string, metadata: Record<string, any>): number {
    if (blockType === 'heading') {
      const level = metadata.level || 1;
      return level + 1; // "# " = level hashes + 1 space
    } else if (blockType === 'ul') {
      return 2; // "- "
    } else if (blockType === 'ol') {
      const number = metadata.number || 1;
      return number.toString().length + 2; // "1. " = number + ". "
    }

    // For paragraph, no syntax
    return 0;
  }

  /**
   * Remove a block from the tree
   */
  private removeBlockFromTree(blockToRemove: Block): void {
    if (!this.root) return;

    // If removing the root
    if (this.root === blockToRemove) {
      this.root = blockToRemove.next;
      return;
    }

    // Find and remove the block
    const removeFromChain = (parent: Block | null, current: Block | null): boolean => {
      if (!current) return false;

      // Check if current's child is the target
      if (current.child === blockToRemove) {
        current.child = blockToRemove.next;
        return true;
      }

      // Check if current's next is the target
      if (current.next === blockToRemove) {
        current.next = blockToRemove.next;
        return true;
      }

      // Recurse
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
    allBlocks.forEach(b => b.isActive = false);

    // Activate the target block
    block.isActive = true;

    // Re-render
    this.render();

    // Restore focus and cursor position
    setTimeout(() => {
      const activeElement = this.editorElement?.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement;
      if (activeElement && activeElement.contentEditable === 'true') {
        activeElement.focus();

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
    this.editorElement.innerHTML = '';

    // Render blocks
    if (this.root) {
      this.renderBlock(this.root, this.editorElement);
    }
  }

  /**
   * Render a single block and its children
   */
  private renderBlock(block: Block, container: HTMLElement): void {
    const plugin = this.blockPlugins.get(block.type);
    if (!plugin) {
      console.warn(`No plugin found for block type: ${block.type}`);
      return;
    }

    // Render the block
    const element = block.isActive
      ? plugin.renderActive(block, 0)
      : plugin.renderInactive(block);

    // Add block ID as data attribute
    element.setAttribute('data-block-id', block.id);

    container.appendChild(element);

    // Render child blocks
    if (block.child) {
      const childContainer = document.createElement('div');
      childContainer.className = 'md-block-children';
      this.renderBlock(block.child, childContainer);
      container.appendChild(childContainer);
    }

    // Render next blocks
    if (block.next) {
      this.renderBlock(block.next, container);
    }
  }

  /**
   * Load markdown text into editor
   */
  private loadMarkdown(markdown: string): void {
    const lines = markdown.split('\n');
    let currentBlock: Block | null = null;

    for (const line of lines) {
      if (line.trim() === '') continue;

      // Try to parse the line using block plugins
      let block: Block | null = null;

      // Try each plugin's parser
      for (const [pluginId, plugin] of this.blockPlugins.entries()) {
        if (!plugin.matcher) continue;

        const matchResult = plugin.matcher(line, 0);
        if (matchResult) {
          // Use the plugin's parse method to get metadata
          const blockData = plugin.parse(line);
          // Store the FULL line as content (including syntax)
          block = BlockTree.createBlock(
            blockData.type,
            line,  // Keep full line with syntax
            blockData.metadata || {}
          );
          break;
        }
      }

      // If no plugin matched, create a paragraph block
      if (!block) {
        block = BlockTree.createBlock('paragraph', line);
      }

      // Add block to the tree
      if (!this.root) {
        this.root = block;
        currentBlock = block;
      } else if (currentBlock) {
        currentBlock.next = block;
        currentBlock = block;
      }
    }

    // If still no root, create empty paragraph
    if (!this.root) {
      this.root = BlockTree.createBlock('paragraph', '');
    }
  }

  /**
   * Trigger onChange callback
   */
  private triggerChange(type: 'content' | 'cursor' | 'selection'): void {
    if (this.config.onChange) {
      const event: ChangeEvent = {
        type,
        timestamp: Date.now()
      };
      this.config.onChange(this, event);
    }
  }

  /**
   * Save editor content as markdown string
   */
  async save(): Promise<string> {
    if (!this.root) return '';

    const blocks = BlockTree.getAllBlocks(this.root);
    const lines: string[] = [];
    let prevBlockType: string | null = null;

    for (const block of blocks) {
      const plugin = this.blockPlugins.get(block.type);
      if (plugin) {
        const markdown = plugin.serialize(block);
        if (markdown) {
          // Add empty line between blocks, except between consecutive list items
          const isCurrentList = block.type === 'ul' || block.type === 'ol';
          const isPrevList = prevBlockType === 'ul' || prevBlockType === 'ol';

          if (prevBlockType && !(isCurrentList && isPrevList)) {
            lines.push(''); // Add empty line
          }

          lines.push(markdown);
          prevBlockType = block.type;
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Load markdown into editor
   */
  async load(markdown: string): Promise<void> {
    this.root = null;
    this.loadMarkdown(markdown);
    this.render();
    this.triggerChange('content');
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
    this.root = BlockTree.createBlock('paragraph', '');
    this.render();
    this.triggerChange('content');
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
      const firstBlock = this.editorElement.querySelector('[data-block-id]') as HTMLElement;
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
    return blocks.every(block => !block.content.trim());
  }
}
