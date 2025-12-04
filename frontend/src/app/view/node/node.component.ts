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
import { KeyboardComponent } from '../../../lib/keyboard/keyboard.component';

@Component({
  selector: 'view-node',
  standalone: true,
  imports: [KeyboardComponent],
  templateUrl: './node.component.html',
  styleUrl: './node.component.scss',
})
export class nodeComponent implements OnInit, OnDestroy {
  node?: Node;
  private editor_label?: EditorJS;
  private editor_edges?: EditorJS;
  private editor_data?: EditorJS;
  @ViewChild('editorLabel') set editorLabel(content: ElementRef) {
    this.startEditor('label', content);
  }
  @ViewChild('editorEdges') set editorEdges(content: ElementRef) {
    this.startEditor('edges', content);
  }
  @ViewChild('editorData') set editorData(content: ElementRef) {
    this.startEditor('data', content);
  }
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
        this.cdr.detectChanges();
        setTimeout(async () => {
          this.node = await this.dh.getNode(NodeID.fromString(nodeIDstr));
          this.data_node = this.node!.kind !== 'Label';
        });
      } catch (error) {
        console.error(`Failed to parse nodeID: ${error}`);
        return;
      }
    });
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
    if (!this.node || !holder) {
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
            blocks: DataHogService.dataNodeToBlocks(this.node!.dataNode),
          },
          nodeComponent.text_tools,
          async (api, _) => {
            const blocks = (await api.saver.save()).blocks;
            const dn = DataHogService.blocksToDataNode(blocks);
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
