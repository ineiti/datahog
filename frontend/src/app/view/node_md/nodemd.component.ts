import { Component, OnInit, OnDestroy, ElementRef, input, HostListener } from '@angular/core';
import EditorJS, {
  API,
  BlockMutationEvent,
  OutputBlockData,
  OutputData,
  ToolConstructable,
  ToolSettings,
} from '@editorjs/editorjs';
import Header from '@editorjs/header';
import List from '@editorjs/list';
import { DataNode, Node } from 'datahog-npm';
import { DataHogService } from '../../data-hog';

@Component({
  selector: 'view-nodemd',
  standalone: true,
  templateUrl: './nodemd.component.html',
  styleUrl: './nodemd.component.scss',
})
export class nodemdComponent implements OnInit, OnDestroy {
  node = input.required<Node>();
  private editor_label?: EditorJS;
  private editor_edges?: EditorJS;
  private editor_data?: EditorJS;

  optionKeyPressed = false;

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

  constructor(
    private elementRef: ElementRef,
    private dh: DataHogService,
  ) {
    // Capture keyboard events in capture phase to prevent EditorJS from receiving them
  }

  async ngOnInit() {
    this.editor_label = await this.initializeEditor(
      '#editor_label',
      {
        blocks: [{ type: 'paragraph', data: { text: this.node().label } }],
      },
      undefined,
      async (api, _) => {
        let data = await api.blocks.getBlockByIndex(0)?.save();
        this.node().label = data!.data.text;
        await this.dh.updateNode(this.node());
      },
    );
    setTimeout(() => this.editor_label!.focus(), 10);
    this.editor_edges = await this.initializeEditor('#editor_edges');
    this.editor_data = await this.initializeEditor(
      '#editor_data',
      {
        blocks: nodemdComponent.dataNodeToBlocks(this.node().dataNode),
      },
      nodemdComponent.text_tools,
      async (api, _) => {
        const blocks = (await api.saver.save()).blocks;
        const dn = nodemdComponent.blocksToDataNode(blocks);
        console.log(dn.data);
        this.node().dataNode = dn;
        await this.dh.updateNode(this.node());
      },
    );
  }

  static blocksToDataNode(blocks: OutputBlockData[]): DataNode {
    const block = blocks.shift();
    if (block === undefined) {
      return new DataNode('empty');
    }
    const dn = new DataNode(`${JSON.stringify(block)}`);
    if (blocks.length > 0) {
      dn.set_sibling(nodemdComponent.blocksToDataNode(blocks));
    }
    return dn;
  }

  static dataNodeToBlocks(dn: DataNode): OutputBlockData[] {
    const bds = dn.sibling.length > 0 ? nodemdComponent.dataNodeToBlocks(dn.sibling[0]) : [];
    let bd = JSON.parse(dn.data);
    if (bd.id === undefined || bd.type === undefined || bd.data === undefined) {
      bd = { type: 'paragraph', data: { text: dn.data } };
    }
    bds.unshift(bd);
    return bds;
  }

  ngOnDestroy() {
    this.editor_label?.destroy();
    this.editor_edges?.destroy();
    this.editor_data?.destroy();
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Alt') {
      this.optionKeyPressed = true;
    }

    console.log(event);

    if (event.altKey) {
      switch (event.code) {
        case 'KeyL':
          return this.focusEditor(this.editor_label);
        case 'KeyE':
          return this.focusEditor(this.editor_edges);
        case 'KeyD':
          return this.focusEditor(this.editor_data);
      }
    }

    return true;
  }

  @HostListener('window:keyup', ['$event'])
  handleKeyUp(event: KeyboardEvent) {
    if (event.key === 'Alt') {
      this.optionKeyPressed = false;
    }
  }

  private focusEditor(editor?: EditorJS): boolean {
    console.log('focussing on', editor);
    if (editor) {
      try {
        // This is to avoid composed keypresses on mac os X to go through.
        // E.g., on US keyboard, option+E is a composed key.
        this.elementRef.nativeElement.querySelector('#hidden')!.focus();
        setTimeout(() => {
          editor.focus();
        }, 10);
      } catch (error) {
        console.error('Failed to focus editor:', error);
      }
    }
    return false;
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
