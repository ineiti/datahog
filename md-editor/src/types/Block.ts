/**
 * Block represents a single block in the editor's content tree.
 * Blocks form a hierarchical tree structure where each block has:
 * - child: Optional nested block (for content under headings, or list items containing sublists)
 * - next: Optional sibling block (next block at same level)
 * - content: Text content with inline formatting
 * - type: Block type identifier (heading, list, etc.)
 * - metadata: Type-specific data (heading level, list style, etc.)
 */
export interface Block {
  id: string;
  type: string;
  content: string;
  metadata: Record<string, any>;
  child: Block | null;
  next: Block | null;
  isActive: boolean;
}

/**
 * BlockData is used for initialization and serialization
 */
export interface BlockData {
  type: string;
  content: string;
  metadata?: Record<string, any>;
  child?: BlockData | null;
  next?: BlockData | null;
}

/**
 * CursorPosition represents where the cursor is in the block tree
 */
export interface CursorPosition {
  block: Block;
  offset: number; // Character offset in block content
}

/**
 * SelectionRange represents a selection spanning multiple positions
 */
export interface SelectionRange {
  start: CursorPosition;
  end: CursorPosition;
}
