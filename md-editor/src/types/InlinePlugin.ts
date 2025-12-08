/**
 * InlineMatch represents a matched inline format in text
 */
export interface InlineMatch {
  start: number; // Start position in text
  end: number; // End position in text
  type: string; // Inline type
  raw: string; // Raw markdown text
}

/**
 * InlineData is the parsed structure for inline elements
 */
export interface InlineData {
  type: string;
  content: string; // Inner content
  metadata?: Record<string, any>; // Type-specific data (e.g., URL for links)
}

/**
 * InlinePlugin defines the API for inline formatting plugins
 */
export interface InlinePlugin {
  // Unique identifier
  id: string;

  // Display name
  name: string;

  // Group membership (e.g., 'basic-formatting', 'links')
  groups: string[];

  // Priority for overlapping matches (higher = first)
  priority: number;

  // Match inline syntax in text
  // Returns ranges that should be formatted
  match(text: string): InlineMatch[];

  // Parse markdown syntax to data structure
  parse(markdown: string, match: InlineMatch): InlineData;

  // Serialize back to markdown
  serialize(data: InlineData): string;

  // Render in inactive state (cursor not touching)
  renderInactive(data: InlineData): HTMLElement | string;

  // Render in active state (cursor touching)
  renderActive(data: InlineData, cursorOffset: number): HTMLElement | string;

  // Handle keyboard shortcuts (e.g., Ctrl+B for bold)
  shortcut?: string;

  // Can this inline wrap selected text?
  canWrapSelection?: boolean;

  // Wrap selected text with this inline format
  wrapSelection?(selectedText: string): string;

  // Auto-completion patterns for comfortable typing
  // When trigger character is typed, insert before/after cursor
  autoComplete?: Array<{
    trigger: string;    // Character that triggers (e.g., "*" or "[")
    before: string;     // Text to insert before cursor (e.g., "*")
    after: string;      // Text to insert after cursor (e.g., "*")
  }>;
}
