import { Component, OnInit, OnDestroy, ElementRef } from '@angular/core';
import EditorJS, { OutputData } from '@editorjs/editorjs';

// Import types to avoid TypeScript errors
// @ts-ignore
import Header from '@editorjs/header';
// @ts-ignore
import List from '@editorjs/list';

@Component({
  selector: 'app-editorjs',
  standalone: true,
  templateUrl: './editorjs.component.html',
  styleUrl: './editorjs.component.scss',
})
export class EditorJSComponent implements OnInit, OnDestroy {
  private editor: EditorJS | null = null;

  constructor(private elementRef: ElementRef) {}

  async ngOnInit() {
    await this.initializeEditor();
  }

  ngOnDestroy() {
    if (this.editor) {
      this.editor.destroy();
    }
  }

  private async initializeEditor() {
    const editorElement = this.elementRef.nativeElement.querySelector('#editorjs');
    if (!editorElement) {
      console.error('Editor element not found');
      return;
    }

    this.editor = new EditorJS({
      holder: 'editorjs',
      placeholder: 'Type "/" for commands, or use #, ##, - for shortcuts...',
      tools: {
        header: {
          class: Header as any,
          inlineToolbar: true,
          config: {
            placeholder: 'Enter a header',
            levels: [1, 2, 3, 4, 5, 6],
            defaultLevel: 2,
          },
        },
        list: {
          class: List as any,
          inlineToolbar: true,
          config: {
            defaultStyle: 'unordered',
          },
        },
      },
      data: {
        blocks: [
          {
            type: 'header',
            data: {
              text: 'EditorJS Example',
              level: 1,
            },
          },
          {
            type: 'paragraph',
            data: {
              text: 'This is a simple EditorJS editor implementation. Here are some features:',
            },
          },
          {
            type: 'list',
            data: {
              style: 'unordered',
              items: [
                'Click the <b>+</b> button on the left to add new blocks',
                'Use <b>Tab</b> and <b>Shift+Tab</b> to indent list items',
                'Drag blocks using the drag handle to reorder them',
                'Select text to see inline formatting options',
              ],
            },
          },
          {
            type: 'header',
            data: {
              text: 'Start editing here',
              level: 2,
            },
          },
          {
            type: 'paragraph',
            data: {
              text: 'Click here to start typing...',
            },
          },
        ],
      },
      onChange: async (api, event) => {
        await this.handleMarkdownShortcuts(api, event);
      },
    });
  }

  private async handleMarkdownShortcuts(api: any, event: any) {
    if (!this.editor) return;

    try {
      // Get current block index using the api
      const currentIndex = api.blocks.getCurrentBlockIndex();

      // Get block data directly without calling save
      const currentBlock = await api.blocks.getBlockByIndex(currentIndex);

      if (!currentBlock) return;

      const blockData = currentBlock as any;

      // Only process paragraph blocks
      if (blockData.name !== 'paragraph') return;

      // Get text directly from the DOM since save() returns old state
      const blockElement = blockData.holder;
      const contentElement = blockElement?.querySelector('[contenteditable="true"]');

      if (!contentElement) return;

      const text = contentElement.textContent || '';

      console.log('Current text:', JSON.stringify(text), 'Length:', text.length);

      // Check for markdown patterns at the start with space
      if (text.match(/^###\s/)) {
        const cleanText = text.replace(/^###\s/, '');
        this.convertBlockFast(api, currentIndex, 'header', {
          level: 3,
          text: cleanText,
        });
      } else if (text.match(/^##\s/)) {
        const cleanText = text.replace(/^##\s/, '');
        this.convertBlockFast(api, currentIndex, 'header', {
          level: 2,
          text: cleanText,
        });
      } else if (text.match(/^#\s/)) {
        const cleanText = text.replace(/^#\s/, '');
        this.convertBlockFast(api, currentIndex, 'header', {
          level: 1,
          text: cleanText,
        });
      } else if (text.match(/^-\s/)) {
        const cleanText = text.replace(/^-\s/, '');
        this.convertBlockFast(api, currentIndex, 'list', {
          style: 'unordered',
          items: [cleanText],
        });
      }
    } catch (error) {
      // Silently ignore errors during conversion
    }
  }

  private convertBlockFast(api: any, index: number, type: string, data: any) {
    try {
      // Delete current block and insert new one using api - no await for speed
      api.blocks.delete(index);
      api.blocks.insert(type, data, {}, index, true);

      // Set cursor to the end of the new block immediately
      setTimeout(() => {
        api.caret.setToBlock(index, 'end');
      }, 0);
    } catch (error) {
      console.error('Error converting block:', error);
    }
  }
}
