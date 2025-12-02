import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  HostListener,
  ViewChild,
  ChangeDetectorRef,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
import { DataNode, Node, NodeID } from 'datahog-npm';
import { DataHogService } from '../../data-hog';
import { ContextMenu } from 'primeng/contextmenu';
import { MenuItem } from 'primeng/api';

@Component({
  selector: 'view-node',
  standalone: true,
  imports: [ContextMenu],
  templateUrl: './node.component.html',
  styleUrl: './node.component.scss',
})
export class nodeComponent implements OnInit, OnDestroy {
  node?: Node;
  private editor_label?: EditorJS;
  private editor_edges?: EditorJS;
  private editor_data?: EditorJS;
  @ViewChild('cm') contextMenu?: ContextMenu;
  @ViewChild('editorLabel') set editorLabel(content: ElementRef) {
    if (content && this.node) {
      this.startEditor('label', content);
    }
  }
  @ViewChild('editorEdges') set editorEdges(content: ElementRef) {
    if (content && this.node) {
      this.startEditor('edges', content);
    }
  }
  @ViewChild('editorData') set editorData(content: ElementRef) {
    if (content && this.node) {
      this.startEditor('data', content);
    }
  }
  // @ViewChild('editorEdges') set editorLabel;
  items: MenuItem[] = [
    { label: 'Label', command: () => this.newNode('Label') },
    { label: 'Markdown', command: () => this.newNode('Markdown') },
    { label: 'Schema', command: () => this.newNode('Schema') },
  ];
  data_node = false;

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
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {
    // Capture keyboard events in capture phase to prevent EditorJS from receiving them
  }

  async ngOnInit() {
    // Subscribe to route parameter changes
    this.route.paramMap.subscribe(async (params) => {
      const nodeIDstr = params.get('nodeID');
      if (!nodeIDstr) {
        console.error('No nodeID provided in route');
        return;
      }

      try {
        // Clean up existing editors before loading new node
        this.editor_label?.destroy();
        this.editor_edges?.destroy();
        this.editor_data?.destroy();

        this.node = undefined; // Reset to show loading state
        this.node = await this.dh.getNode(NodeID.fromString(nodeIDstr));
        console.log('Node is:', this.node!.to_string());

        // Trigger change detection to update template and ViewChild elements
        this.cdr.detectChanges();
      } catch (error) {
        console.error(`Failed to parse nodeID: ${error}`);
        return;
      }
    });
  }

  static blocksToDataNode(blocks: OutputBlockData[]): DataNode {
    const block = blocks.shift();
    if (block === undefined) {
      return new DataNode('empty');
    }
    const dn = new DataNode(`${JSON.stringify(block)}`);
    if (blocks.length > 0) {
      dn.set_sibling(nodeComponent.blocksToDataNode(blocks));
    }
    return dn;
  }

  static dataNodeToBlocks(dn: DataNode): OutputBlockData[] {
    const bds = dn.sibling.length > 0 ? nodeComponent.dataNodeToBlocks(dn.sibling[0]) : [];
    try {
      let bd = JSON.parse(dn.data);
      if (bd.id === undefined || bd.type === undefined || bd.data === undefined) {
        bd = { type: 'paragraph', data: { text: dn.data } };
      }
      bds.unshift(bd);
    } catch (e) {
      console.warn(`Couldn't parse JSON of dataNode: ${e}`);
    }
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

    if (event.altKey) {
      switch (event.code) {
        case 'KeyL':
          return this.focusEditor(this.editor_label);
        case 'KeyE':
          return this.focusEditor(this.editor_edges);
        case 'KeyD':
          return this.focusEditor(this.editor_data);
        case 'KeyN':
          this.omitCombined(() => this.contextMenu!.show(event));
          return false;
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

  private async newNode(type: string) {
    let node: Node | undefined;
    switch (type) {
      case 'Label':
        node = Node.new_label('Label');
        break;
      case 'Markdown':
        node = Node.new_mime('Label MD', 'Markdown');
        break;
      case 'Schema':
        node = Node.new_schema('Label schema');
        break;
      default:
        return;
    }
    await this.dh.updateNode(node);
    // Navigate to the newly created node
    await this.router.navigate(['/node', node.id.toString()]);
  }

  private focusEditor(editor?: EditorJS): boolean {
    if (editor) {
      try {
        // This is to avoid composed keypresses on mac os X to go through.
        // E.g., on US keyboard, option+E is a composed key.
        this.omitCombined(() => editor.focus());
      } catch (error) {
        console.error('Failed to focus editor:', error);
      }
    }
    return false;
  }

  private omitCombined(cb: () => void) {
    this.elementRef.nativeElement.querySelector('#hidden')!.focus();
    setTimeout(() => {
      cb();
    }, 10);
  }

  private async startEditor(name: String, holder?: ElementRef<HTMLHtmlElement>) {
    if (!holder) {
      return;
    }
    switch (name) {
      case 'label':
        this.editor_label = await this.initializeEditor(
          holder,
          {
            blocks: [{ type: 'paragraph', data: { text: this.node!.label } }],
          },
          undefined,
          async (api, _) => {
            let data = await api.blocks.getBlockByIndex(0)?.save();
            this.node!.label = data!.data.text;
            await this.dh.updateNode(this.node!);
          },
        );
        setTimeout(() => this.editor_label!.focus(), 10);
        break;
      case 'edges':
        this.editor_edges = await this.initializeEditor(holder);
        break;
      case 'data':
        this.editor_data = await this.initializeEditor(
          holder,
          {
            blocks: nodeComponent.dataNodeToBlocks(this.node!.dataNode),
          },
          nodeComponent.text_tools,
          async (api, _) => {
            const blocks = (await api.saver.save()).blocks;
            const dn = nodeComponent.blocksToDataNode(blocks);
            this.node!.dataNode = dn;
            await this.dh.updateNode(this.node!);
          },
        );
        break;
    }
  }

  private async initializeEditor(
    holder?: ElementRef<HTMLHtmlElement>,
    data?: OutputData,
    tools?: { [toolName: string]: ToolConstructable | ToolSettings },
    onChange?: (api: API, event: BlockMutationEvent | BlockMutationEvent[]) => Promise<void>,
  ): Promise<EditorJS | undefined> {
    if (!holder) {
      console.warn(`Editor disappeared`);
      return undefined;
    }

    return new Promise((resolve) => {
      const editor = new EditorJS({
        holder: holder.nativeElement,
        data,
        placeholder: `Start adding`,
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
