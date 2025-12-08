import { EditorConfig, ChangeEvent } from '../types/EditorConfig.js';
import { EditorAPI } from '../types/EditorAPI.js';
import { Block } from '../types/Block.js';
import { BlockTree } from './BlockTree.js';
import { BlockPlugin } from '../types/BlockPlugin.js';

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
      this.config.onReady();
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

    // Listen for click events to track cursor
    this.editorElement.addEventListener('click', (e) => {
      this.handleClick(e);
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

    // Update block content
    block.content = target.textContent || '';

    // Trigger onChange
    this.triggerChange('content');
  }

  /**
   * Handle click events
   */
  private handleClick(e: Event): void {
    const target = e.target as HTMLElement;
    if (!target) return;

    // Mark block as active
    const blockId = target.getAttribute('data-block-id');
    if (blockId) {
      this.setActiveBlock(blockId);
    }
  }

  /**
   * Set a block as active
   */
  private setActiveBlock(blockId: string): void {
    const allBlocks = BlockTree.getAllBlocks(this.root);

    // Deactivate all blocks
    allBlocks.forEach(block => block.isActive = false);

    // Activate the target block
    const block = BlockTree.findBlockById(this.root, blockId);
    if (block) {
      block.isActive = true;
      this.render();

      // Restore focus to the active block element
      setTimeout(() => {
        const activeElement = this.editorElement?.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement;
        if (activeElement && activeElement.contentEditable === 'true') {
          activeElement.focus();

          // Place cursor at the end of the content
          const range = document.createRange();
          const sel = window.getSelection();
          if (activeElement.childNodes.length > 0) {
            const textNode = activeElement.childNodes[0];
            range.setStart(textNode, textNode.textContent?.length || 0);
            range.collapse(true);
            sel?.removeAllRanges();
            sel?.addRange(range);
          }
        }
      }, 0);
    }
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
    // For Phase 1, just create a single paragraph block
    const lines = markdown.split('\n');
    let currentBlock: Block | null = null;

    for (const line of lines) {
      if (line.trim() === '') continue;

      const block = BlockTree.createBlock('paragraph', line);

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

    for (const block of blocks) {
      const plugin = this.blockPlugins.get(block.type);
      if (plugin) {
        const markdown = plugin.serialize(block);
        if (markdown) {
          lines.push(markdown);
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
