/**
 * @datahog/md-editor
 * Framework-agnostic markdown editor with Obsidian-style mixed display mode
 */

// Export main editor class
export { MarkdownEditor } from './core/MarkdownEditor.js';

// Export types
export type {
  Block,
  BlockData,
  CursorPosition,
  SelectionRange
} from './types/Block.js';

export type {
  BlockPlugin,
  BlockMatchResult,
  BlockAction
} from './types/BlockPlugin.js';

export type {
  InlinePlugin,
  InlineMatch,
  InlineData
} from './types/InlinePlugin.js';

export type {
  EditorConfig,
  BlockPluginConfig,
  ChangeEvent
} from './types/EditorConfig.js';

export type {
  EditorAPI
} from './types/EditorAPI.js';

export type {
  EditorState,
  HistoryEntry
} from './types/EditorState.js';

// Export utilities
export { BlockTree } from './core/BlockTree.js';
