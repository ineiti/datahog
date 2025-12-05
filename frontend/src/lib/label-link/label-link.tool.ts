import { InlineTool, API, InlineToolConstructorOptions } from '@editorjs/editorjs';
import { DataHogService } from '../../app/data-hog';
import { Node as DataNode } from 'datahog-npm';

interface LabelLinkConfig {
  dataHogService: DataHogService;
}

export default class LabelLinkTool implements InlineTool {
  private static dataHogService: DataHogService;

  private api: API;
  private button: HTMLButtonElement | null = null;
  private tag: string = 'SPAN';
  private class: string = 'label-link';
  private autocompleteContainer: HTMLDivElement | null = null;
  private currentTextNode: Node | null = null;
  private currentLinkStart: number = -1;
  private currentLinkEnd: number = -1;
  private searchTimeout: number | null = null;

  static get isInline(): boolean {
    return true;
  }

  static get title(): string {
    return 'Label Link';
  }

  static configure(dataHogService: DataHogService): void {
    LabelLinkTool.dataHogService = dataHogService;
  }

  constructor({ api, config }: InlineToolConstructorOptions) {
    this.api = api;

    const configService = (config as LabelLinkConfig)?.dataHogService;
    console.log(config, configService);
    if (configService && typeof configService.searchLabels === 'function') {
      console.log('Using config service');
      LabelLinkTool.dataHogService = configService;
    } else {
      console.error('something went wrong with the service');
    }

    if (!LabelLinkTool.dataHogService) {
      console.error(
        'LabelLinkTool: dataHogService not provided. Call LabelLinkTool.configure() first.',
      );
    } else {
      console.log(
        'LabelLinkTool: dataHogService is set, searchLabels type:',
        typeof LabelLinkTool.dataHogService.searchLabels,
      );
    }

    // Setup keyboard listener for [[ trigger
    this.setupKeyboardListener();
  }

  render(): HTMLElement {
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.innerHTML = '[[]]';
    this.button.classList.add(this.api.styles.inlineToolButton);
    return this.button;
  }

  surround(range: Range): void {
    if (!range) {
      return;
    }

    const selectedText = range.toString();
    const span = document.createElement(this.tag);
    span.classList.add(this.class);
    span.setAttribute('data-label', selectedText);
    span.textContent = `[[${selectedText}]]`;

    range.deleteContents();
    range.insertNode(span);

    this.api.selection.expandToTag(span);
  }

  checkState(): boolean {
    const selection = window.getSelection();
    if (!selection || !selection.anchorNode) {
      return false;
    }

    const element = selection.anchorNode.parentElement;
    return !!element?.classList.contains(this.class);
  }

  static get sanitize() {
    return {
      span: {
        class: 'label-link',
        'data-label': true,
      },
    };
  }

  private setupKeyboardListener(): void {
    // We'll attach this to the editor on ready
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('input', this.handleInput.bind(this));
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;

    // Only handle in editor context
    if (!this.isInEditor(target)) {
      return;
    }

    // Handle escape to close autocomplete
    if (event.key === 'Escape' && this.autocompleteContainer) {
      event.preventDefault();
      this.closeAutocomplete(true); // Clear context when user cancels with Escape
      return;
    }

    // Handle arrow keys and enter in autocomplete
    if (this.autocompleteContainer) {
      console.log('Autocomplete is open, key pressed:', event.key);
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        console.log('Arrow key detected');
        event.preventDefault();
        this.navigateAutocomplete(event.key === 'ArrowDown' ? 1 : -1);
        return;
      }
      if (event.key === 'Enter') {
        console.log('Enter key detected with autocomplete open');
        event.preventDefault();
        this.selectCurrentAutocomplete();
        return;
      }
    }
  }

  private handleInput(event: Event): void {
    const target = event.target as HTMLElement;

    if (!this.isInEditor(target)) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    const textNode = range.startContainer;

    if (textNode.nodeType !== 3) {
      // Node.TEXT_NODE
      return;
    }

    const text = textNode.textContent || '';
    const cursorPos = range.startOffset;

    // Check if user just typed [[
    if (text.slice(Math.max(0, cursorPos - 2), cursorPos) === '[[') {
      // Auto-insert ]]
      const textBefore = text.slice(0, cursorPos);
      const textAfter = text.slice(cursorPos);
      textNode.textContent = textBefore + ']]' + textAfter;

      // Move cursor between [[ and ]]
      range.setStart(textNode, cursorPos);
      range.setEnd(textNode, cursorPos);
      selection.removeAllRanges();
      selection.addRange(range);

      // Store context for later selection
      this.currentTextNode = textNode;
      this.currentLinkStart = cursorPos - 2; // Position of [[
      this.currentLinkEnd = cursorPos + 2; // Position of ]]
      console.log('Initial link context stored:', {
        textNode,
        linkStart: this.currentLinkStart,
        linkEnd: this.currentLinkEnd,
        text: textNode.textContent.slice(this.currentLinkStart, this.currentLinkEnd),
      });

      // Show autocomplete
      this.showAutocomplete('');
      return;
    }

    // Check if we're inside [[ ]]
    const linkMatch = this.findLinkAtCursor(text, cursorPos);
    if (linkMatch) {
      // Update stored context if text node is the same
      if (this.currentTextNode === textNode) {
        // Text node is the same, just update positions
        this.currentLinkStart = linkMatch.start - 2;
        this.currentLinkEnd = linkMatch.end + 2;
      } else {
        // Different text node, store new context
        this.currentTextNode = textNode;
        this.currentLinkStart = linkMatch.start - 2;
        this.currentLinkEnd = linkMatch.end + 2;
      }
      console.log('Updated link context:', {
        textNode,
        linkStart: this.currentLinkStart,
        linkEnd: this.currentLinkEnd,
        text: text.slice(this.currentLinkStart, this.currentLinkEnd),
      });
      this.showAutocomplete(linkMatch.query);
    } else if (this.autocompleteContainer) {
      this.closeAutocomplete(true); // Clear context when cursor leaves [[ ]]
    }
  }

  private findLinkAtCursor(
    text: string,
    cursorPos: number,
  ): { query: string; start: number; end: number } | null {
    // Find the nearest [[ before cursor
    let start = text.lastIndexOf('[[', cursorPos - 1);
    if (start === -1) {
      return null;
    }

    // Find the nearest ]] after the [[
    let end = text.indexOf(']]', start);
    if (end === -1 || end < cursorPos) {
      return null;
    }

    // Extract the query between [[ and cursor
    const query = text.slice(start + 2, cursorPos);
    return { query, start: start + 2, end };
  }

  private showAutocomplete(query: string): void {
    console.log('showAutocomplete called with query:', query);

    // Capture the current context NOW before it's lost
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const textNode = range.startContainer;

      if (textNode.nodeType === 3) {
        // TEXT_NODE
        const text = textNode.textContent || '';
        const cursorPos = range.startOffset;

        // Find the [[ ]] boundaries
        const linkMatch = this.findLinkAtCursor(text, cursorPos);
        if (linkMatch) {
          this.currentTextNode = textNode;
          this.currentLinkStart = linkMatch.start - 2;
          this.currentLinkEnd = linkMatch.end + 2;
          console.log('Captured context in showAutocomplete:', {
            textNode,
            linkStart: this.currentLinkStart,
            linkEnd: this.currentLinkEnd,
            text: text.slice(this.currentLinkStart, this.currentLinkEnd),
          });
        }
      }
    }

    // Debounce the search
    if (this.searchTimeout) {
      window.clearTimeout(this.searchTimeout);
    }

    if (!LabelLinkTool.dataHogService) {
      console.error('LabelLinkTool: dataHogService is not initialized');
      return;
    }

    this.searchTimeout = window.setTimeout(async () => {
      const labels = await LabelLinkTool.dataHogService.searchLabels(query);
      this.renderAutocomplete(labels);
    }, 150);
  }

  private renderAutocomplete(labels: DataNode[]): void {
    // Close existing autocomplete but keep context (we're just refreshing the list)
    this.closeAutocomplete(false);

    if (labels.length === 0) {
      return;
    }

    // Create autocomplete container
    this.autocompleteContainer = document.createElement('div');
    this.autocompleteContainer.classList.add('label-link-autocomplete');

    // Get cursor position to place dropdown
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    this.autocompleteContainer.style.position = 'fixed';
    this.autocompleteContainer.style.left = `${rect.left}px`;
    this.autocompleteContainer.style.top = `${rect.bottom + 5}px`;
    this.autocompleteContainer.style.zIndex = '1000';

    // Add label items
    labels.slice(0, 10).forEach((label, index) => {
      const item = document.createElement('div');
      item.classList.add('label-link-item');
      if (index === 0) {
        item.classList.add('selected');
      }
      item.textContent = label.label;
      item.setAttribute('data-label', label.label);

      item.addEventListener('click', (e) => {
        console.log('Click event on label item:', label.label);
        e.preventDefault();
        e.stopPropagation();
        this.selectLabel(label.label);
      });

      item.addEventListener('mousedown', (e) => {
        console.log('Mousedown event on label item:', label.label);
        e.preventDefault(); // Prevent losing focus from editor
      });

      this.autocompleteContainer!.appendChild(item);
    });

    document.body.appendChild(this.autocompleteContainer);
  }

  private navigateAutocomplete(direction: number): void {
    if (!this.autocompleteContainer) {
      return;
    }

    const items = Array.from(this.autocompleteContainer.querySelectorAll('.label-link-item'));
    const currentIndex = items.findIndex((item) => item.classList.contains('selected'));

    if (currentIndex === -1) {
      return;
    }

    items[currentIndex].classList.remove('selected');

    let newIndex = currentIndex + direction;
    if (newIndex < 0) {
      newIndex = items.length - 1;
    } else if (newIndex >= items.length) {
      newIndex = 0;
    }

    items[newIndex].classList.add('selected');
    items[newIndex].scrollIntoView({ block: 'nearest' });
  }

  private selectCurrentAutocomplete(): void {
    console.log('selectCurrentAutocomplete called');
    if (!this.autocompleteContainer) {
      console.error('No autocomplete container');
      return;
    }

    const selectedItem = this.autocompleteContainer.querySelector(
      '.label-link-item.selected',
    ) as HTMLElement;
    console.log('Selected item:', selectedItem);
    if (selectedItem) {
      const label = selectedItem.getAttribute('data-label');
      console.log('Label from selected item:', label);
      if (label) {
        this.selectLabel(label);
      }
    } else {
      console.error('No selected item found');
    }
  }

  private selectLabel(label: string): void {
    console.log('selectLabel called with:', label);
    console.log('currentTextNode:', this.currentTextNode);
    console.log('currentLinkStart:', this.currentLinkStart);
    console.log('currentLinkEnd:', this.currentLinkEnd);

    if (!this.currentTextNode || this.currentLinkStart === -1 || this.currentLinkEnd === -1) {
      console.error('No stored link context available');
      return;
    }

    const textNode = this.currentTextNode;

    if (textNode.nodeType !== 3) {
      // Node.TEXT_NODE
      console.error('Stored node is not a text node');
      return;
    }

    const text = textNode.textContent || '';
    console.log('Current text in node:', text);
    console.log('Link text to replace:', text.slice(this.currentLinkStart, this.currentLinkEnd));

    const textBefore = text.slice(0, this.currentLinkStart);
    const textAfter = text.slice(this.currentLinkEnd);
    console.log('Replacing text - before:', textBefore, 'after:', textAfter);

    // Create the label link span
    const span = document.createElement('span');
    span.classList.add(this.class);
    span.setAttribute('data-label', label);
    span.textContent = `[[${label}]]`;
    span.style.color = '#0066cc';
    span.style.cursor = 'pointer';
    span.style.textDecoration = 'underline';

    // Replace in DOM
    const beforeNode = document.createTextNode(textBefore);
    const afterNode = document.createTextNode(textAfter);

    const parent = textNode.parentNode;
    if (parent) {
      console.log('Replacing in parent:', parent);
      parent.insertBefore(beforeNode, textNode);
      parent.insertBefore(span, textNode);
      parent.insertBefore(afterNode, textNode);
      parent.removeChild(textNode);

      // Move cursor after the link
      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        range.setStartAfter(span);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }

      console.log('Selection completed successfully');

      // Clear context after successful selection
      this.currentTextNode = null;
      this.currentLinkStart = -1;
      this.currentLinkEnd = -1;
    } else {
      console.error('No parent node');
    }

    this.closeAutocomplete(false); // Don't clear context here, we already did it above
  }

  private closeAutocomplete(clearContext: boolean = false): void {
    if (this.autocompleteContainer) {
      this.autocompleteContainer.remove();
      this.autocompleteContainer = null;
    }

    // Only clear the context if explicitly requested
    if (clearContext) {
      this.currentTextNode = null;
      this.currentLinkStart = -1;
      this.currentLinkEnd = -1;
    }
  }

  private isInEditor(element: HTMLElement): boolean {
    // Check if the element is within the EditorJS content
    return !!element.closest('.ce-block');
  }

  clear(): void {
    this.closeAutocomplete(true); // Clear everything
  }
}
