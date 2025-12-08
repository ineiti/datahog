import { Block } from './Block.js';

/**
 * EditorAPI provides methods for interacting with the editor
 */
export interface EditorAPI {
  // Save editor content as markdown string
  save(): Promise<string>;

  // Load markdown into editor
  load(markdown: string): Promise<void>;

  // Get current block tree (for advanced use)
  getBlocks(): Block[];

  // Clear editor content
  clear(): void;

  // Destroy editor instance
  destroy(): void;

  // Focus editor
  focus(): void;

  // Check if editor is empty
  isEmpty(): boolean;
}
