import { BlockPlugin } from "./BlockPlugin.js";
import { InlinePlugin } from "./InlinePlugin.js";
import { BlockData } from "./Block.js";
import { EditorAPI } from "./EditorAPI.js";

/**
 * ChangeEvent is emitted when editor content changes
 */
export interface ChangeEvent {
  type: "content" | "cursor" | "selection";
  timestamp: number;
}

/**
 * EditorConfig is used to initialize the editor
 */
export interface EditorConfig {
  // Required: DOM element to mount the editor
  holder: string | HTMLElement;

  // Block and inline plugins
  tools: {
    blocks?: BlockPlugin[];
    inlines?: InlinePlugin[];
  };

  // Initial editor data (markdown string or block tree)
  data?:
    | string
    | {
        blocks: BlockData[];
      };

  // Optional configuration
  autofocus?: boolean;
  placeholder?: string;
  readOnly?: boolean;
  minHeight?: number;

  // Callbacks
  onChange?: (api: EditorAPI, event: ChangeEvent) => void;
  onReady?: (api: EditorAPI) => void;
}
