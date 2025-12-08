import { Block, BlockData, CursorPosition } from './Block.js';

/**
 * BlockMatchResult is returned when text matches a block pattern
 * e.g., "# " at start → heading block
 */
export interface BlockMatchResult {
  type: string; // Block type to convert to
  consumeChars: number; // How many chars to remove (e.g., 2 for "# ")
  metadata?: Record<string, any>; // Initial metadata
}

/**
 * BlockAction is returned from onKeyDown handlers
 */
export interface BlockAction {
  type: 'continue' | 'stop' | 'create' | 'convert' | 'delete';
  newBlock?: Block;
  insertAs?: 'child' | 'next'; // Where to insert new block (default: 'next')
  convertTo?: string;
  preventDefault?: boolean;
}

/**
 * BlockPlugin defines the API for a block type plugin
 */
export interface BlockPlugin {
  // Unique identifier for this block type
  id: string;

  // Display name for UI
  name: string;

  // Detect if text should convert to this block type
  // e.g., "# " at start → heading block
  matcher?: (text: string, position: number) => BlockMatchResult | null;

  // Parse markdown text into block structure
  parse(markdown: string): BlockData;

  // Serialize block to markdown
  serialize(block: Block): string;

  // Render block in inactive state (pure HTML)
  renderInactive(block: Block): HTMLElement;

  // Render block in active state (with markdown syntax visible)
  renderActive(block: Block, cursorOffset: number): HTMLElement;

  // Handle keyboard input within this block
  onKeyDown?(event: KeyboardEvent, block: Block, cursor: CursorPosition): BlockAction;

  // Handle block-level operations
  onCreate?(block: Block): void;
  onDestroy?(block: Block): void;
  onSplit?(block: Block, offset: number): [Block, Block]; // Enter key
  onMerge?(block: Block, nextBlock: Block): Block; // Backspace at end

  // Metadata operations
  getMetadata?(block: Block): Record<string, any>;
  setMetadata?(block: Block, metadata: Record<string, any>): void;
}
