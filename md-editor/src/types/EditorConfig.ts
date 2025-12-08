import { BlockPlugin } from './BlockPlugin.js';
import { InlinePlugin } from './InlinePlugin.js';
import { BlockData } from './Block.js';
import { EditorAPI } from './EditorAPI.js';

/**
 * Block plugin configuration allows attaching inline groups
 */
export interface BlockPluginConfig {
  plugin: BlockPlugin;
  inlineGroups?: string[]; // Which inline groups this block supports
}

/**
 * ChangeEvent is emitted when editor content changes
 */
export interface ChangeEvent {
  type: 'content' | 'cursor' | 'selection';
  timestamp: number;
}

/**
 * EditorConfig is used to initialize the editor
 */
export interface EditorConfig {
  // Required: DOM element to mount the editor
  holder: string | HTMLElement;

  // Block and inline plugins with configuration
  tools: {
    blocks?: Record<string, BlockPluginConfig>;
    inlines?: Record<string, InlinePlugin>;

    // Define inline groups
    inlineGroups?: Record<string, string[]>; // group name -> plugin ids
  };

  // Initial editor data (markdown string or block tree)
  data?: string | {
    blocks: BlockData[];
  };

  // Optional configuration
  autofocus?: boolean;
  placeholder?: string;
  readOnly?: boolean;
  minHeight?: number;

  // Callbacks
  onChange?: (api: EditorAPI, event: ChangeEvent) => void;
  onReady?: () => void;
}
