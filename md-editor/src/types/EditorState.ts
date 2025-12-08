import { Block, CursorPosition, SelectionRange } from './Block.js';

/**
 * HistoryEntry represents a state in the undo/redo history
 */
export interface HistoryEntry {
  root: Block | null;
  cursor: CursorPosition | null;
  timestamp: number;
}

/**
 * EditorState manages the current state of the editor
 */
export interface EditorState {
  root: Block | null; // First block in tree
  cursor: CursorPosition | null;
  selection: SelectionRange | null;
  history: HistoryEntry[];
  historyIndex: number;
}
