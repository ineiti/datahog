import { ZERO_WIDTH_SPACE } from "./constants.js";

/**
 * DOM utility functions for markdown editor
 */

/**
 * Appends syntax and content spans to a parent element
 * This creates the structure: <parent><span class="md-syntax">syntax</span><span class="md-content">content</span></parent>
 *
 * @param parent The parent HTMLElement to append spans to
 * @param syntax The markdown syntax string (e.g., "# ", "- ", "1. ")
 * @param content The content string after the syntax
 * @param useZeroWidthFallback If true, uses zero-width space when content is empty (default: false)
 */
export function appendSyntaxContentSpans(
  parent: HTMLElement,
  syntax: string,
  content: string,
  useZeroWidthFallback: boolean = false,
): void {
  const syntaxSpan = document.createElement("span");
  syntaxSpan.className = "md-syntax";
  syntaxSpan.textContent = syntax;
  parent.appendChild(syntaxSpan);

  const contentSpan = document.createElement("span");
  contentSpan.className = "md-content";

  if (useZeroWidthFallback && !content) {
    contentSpan.textContent = ZERO_WIDTH_SPACE;
  } else {
    contentSpan.textContent = content;
  }

  parent.appendChild(contentSpan);
}
