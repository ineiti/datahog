import { Component, OnInit, OnDestroy, ElementRef } from '@angular/core';
import EditorJS, { ToolConstructable } from '@editorjs/editorjs';
import Header from '@editorjs/header';
import List from '@editorjs/list';

@Component({
  selector: 'view-nodemd',
  standalone: true,
  templateUrl: './nodemd.component.html',
  styleUrl: './nodemd.component.scss',
})
export class nodemdComponent implements OnInit, OnDestroy {
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
    const editorElement = this.elementRef.nativeElement.querySelector('#nodemd');
    if (!editorElement) {
      console.error('Editor element not found');
      return;
    }

    this.editor = new EditorJS({
      holder: 'nodemd',
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
          class: List,
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
              text: 'nodemd Example',
              level: 1,
            },
          },
          {
            type: 'paragraph',
            data: {
              text: 'This is a simple nodemd editor implementation. Here are some features:',
            },
          },
          {
            type: 'list',
            data: {
              style: 'unordered',
              items: ['One', 'Two'],
            },
          },
        ],
      },
      onChange: async (api, event) => {},
    });
  }
}
