import { Block, BlockData } from '../types/Block.js';

/**
 * BlockTree manages the hierarchical block structure
 */
export class BlockTree {
  /**
   * Generate a unique block ID
   */
  static generateId(): string {
    return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a new block from data
   */
  static createBlock(type: string, content: string = '', metadata: Record<string, any> = {}): Block {
    return {
      id: BlockTree.generateId(),
      type,
      content,
      metadata,
      child: null,
      next: null,
      isActive: false
    };
  }

  /**
   * Create a block tree from BlockData
   */
  static fromData(data: BlockData): Block {
    const block = BlockTree.createBlock(data.type, data.content, data.metadata || {});

    if (data.child) {
      block.child = BlockTree.fromData(data.child);
    }

    if (data.next) {
      block.next = BlockTree.fromData(data.next);
    }

    return block;
  }

  /**
   * Convert a block tree to BlockData
   */
  static toData(block: Block): BlockData {
    const data: BlockData = {
      type: block.type,
      content: block.content,
      metadata: block.metadata
    };

    if (block.child) {
      data.child = BlockTree.toData(block.child);
    }

    if (block.next) {
      data.next = BlockTree.toData(block.next);
    }

    return data;
  }

  /**
   * Find a block by ID in the tree
   */
  static findBlockById(root: Block | null, id: string): Block | null {
    if (!root) return null;
    if (root.id === id) return root;

    // Search in child
    const inChild = BlockTree.findBlockById(root.child, id);
    if (inChild) return inChild;

    // Search in next
    return BlockTree.findBlockById(root.next, id);
  }

  /**
   * Get all blocks in the tree as a flat array (depth-first traversal)
   */
  static getAllBlocks(root: Block | null): Block[] {
    if (!root) return [];

    const blocks: Block[] = [root];

    // Add child blocks
    if (root.child) {
      blocks.push(...BlockTree.getAllBlocks(root.child));
    }

    // Add next blocks
    if (root.next) {
      blocks.push(...BlockTree.getAllBlocks(root.next));
    }

    return blocks;
  }

  /**
   * Insert a block after a specific block
   */
  static insertAfter(target: Block, newBlock: Block): void {
    newBlock.next = target.next;
    target.next = newBlock;
  }

  /**
   * Insert a block as a child of a specific block
   */
  static insertAsChild(target: Block, newBlock: Block): void {
    newBlock.next = target.child;
    target.child = newBlock;
  }

  /**
   * Remove a block from the tree
   * Returns true if the block was found and removed
   */
  static removeBlock(root: Block | null, blockId: string): boolean {
    if (!root) return false;

    // Check if child is the target
    if (root.child && root.child.id === blockId) {
      root.child = root.child.next;
      return true;
    }

    // Check if next is the target
    if (root.next && root.next.id === blockId) {
      root.next = root.next.next;
      return true;
    }

    // Recurse into child and next
    return BlockTree.removeBlock(root.child, blockId) || BlockTree.removeBlock(root.next, blockId);
  }
}
