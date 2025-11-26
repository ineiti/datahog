import { Component, OnInit, OnDestroy, ElementRef, input } from '@angular/core';
import EditorJS, {
  API,
  BlockMutationEvent,
  OutputData,
  ToolConstructable,
  ToolSettings,
} from '@editorjs/editorjs';
import Header from '@editorjs/header';
import List from '@editorjs/list';
// import { NodeW } from 'datahog-npm';

@Component({
  selector: 'view-nodemd',
  standalone: true,
  templateUrl: './nodemd.component.html',
  styleUrl: './nodemd.component.scss',
})
export class nodemdComponent implements OnInit, OnDestroy {
  node = input.required<string>();
  // node = input.required<NodeW>();
  private editor_label?: EditorJS;
  private editor_edges?: EditorJS;
  private editor_data?: EditorJS;

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
    console.log(this.elementRef);
    // console.log(this.node().label);
    // console.log(this.node().labels);
    // console.log(this.node().something);
    this.editor_label = await this.initializeEditor(
      '#editor_label',
      // {
      //   blocks: [{ type: 'paragraph', data: { text: this.node().labels } }],
      // },
      undefined,
      undefined,
      async (api, event) => {
        console.log(event);
        let data = await api.blocks.getBlockByIndex(0)?.save();
        console.log(data);
        // console.log(this.node().something);
        // this.node().set_data(data!.data.text);
      },
    );
    this.editor_edges = await this.initializeEditor('#editor_edges');
    this.editor_data = await this.initializeEditor(
      '#editor_data',
      // {
      //   blocks: [{ type: 'paragraph', data: { text: this.node().data } }],
      // },
      undefined,
      nodemdComponent.text_tools,
    );
  }

  ngOnDestroy() {
    this.editor_label?.destroy();
    this.editor_edges?.destroy();
    this.editor_data?.destroy();
  }

  private async initializeEditor(
    selector: string,
    data?: OutputData,
    tools?: { [toolName: string]: ToolConstructable | ToolSettings },
    onChange?: (api: API, event: BlockMutationEvent | BlockMutationEvent[]) => Promise<void>,
  ): Promise<EditorJS | undefined> {
    const holder = this.elementRef.nativeElement.querySelector(selector);
    if (!holder) {
      console.error(`Editor element ${selector} not found`);
      return undefined;
    }

    return new Promise((resolve) => {
      const editor = new EditorJS({
        holder,
        data,
        placeholder: `Start adding a ${selector}`,
        tools,
        minHeight: 0,

        onChange,

        onReady: async () => {
          resolve(editor);
        },
      });
    });
  }
}
