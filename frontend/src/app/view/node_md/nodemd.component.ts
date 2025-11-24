import { Component, OnInit, OnDestroy, ElementRef, input } from '@angular/core';
import EditorJS, {
  OutputBlockData,
  OutputData,
  ToolConstructable,
  ToolSettings,
} from '@editorjs/editorjs';
import Header from '@editorjs/header';
import List from '@editorjs/list';
import { Node } from 'datahog-npm';

@Component({
  selector: 'view-nodemd',
  standalone: true,
  templateUrl: './nodemd.component.html',
  styleUrl: './nodemd.component.scss',
})
export class nodemdComponent implements OnInit, OnDestroy {
  node = input.required<Node>();
  private editor_labels?: EditorJS;
  private editor_is_a?: EditorJS;
  private editor_contains?: EditorJS;
  private editor_text?: EditorJS;

  private static text_tools = {
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
  };

  constructor(private elementRef: ElementRef) {}

  async ngOnInit() {
    this.editor_labels = await this.initializeEditor('#editor_labels');
    this.editor_is_a = await this.initializeEditor('#editor_is_a');
    this.editor_contains = await this.initializeEditor('#editor_contains');
    this.editor_text = await this.initializeEditor('#editor_text', nodemdComponent.text_tools);
  }

  ngOnDestroy() {
    this.editor_labels?.destroy();
    this.editor_is_a?.destroy();
    this.editor_contains?.destroy();
    this.editor_text?.destroy();
  }

  private async initializeEditor(
    selector: string,
    tools?: { [toolName: string]: ToolConstructable | ToolSettings },
  ): Promise<EditorJS | undefined> {
    const holder = this.elementRef.nativeElement.querySelector(selector);
    if (!holder) {
      console.error('Editor element not found');
      return undefined;
    }

    return new Promise((resolve) => {
      const editor = new EditorJS({
        holder,
        placeholder: `Start adding a ${selector}`,
        tools,
        minHeight: 0,

        onChange: async (api, event) => {},

        onReady: async () => {
          resolve(editor);
        },
      });
    });
  }
}
