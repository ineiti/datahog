import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  ChangeDetectorRef,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import EditorJS, {
  API,
  BlockMutationEvent,
  OutputData,
  ToolConstructable,
  ToolSettings,
} from '@editorjs/editorjs';
import Header from '@editorjs/header';
import List from '@editorjs/list';
import { Node, NodeID } from 'datahog-npm';
import { DataHogService } from '../../data-hog';
import { LabelLinkTool } from '../../../lib/label-link';

@Component({
  selector: 'view-markdown',
  standalone: true,
  imports: [],
  templateUrl: './markdown.component.html',
  styleUrls: ['./markdown.component.scss', '../../../lib/label-link/label-link.styles.scss'],
})
export class MarkdownComponent implements OnInit, OnDestroy {
  node?: Node;
  private editor?: EditorJS;
  @ViewChild('editorData') set editorData(content: ElementRef) {
    this.startEditor(content);
  }

  private getTextTools() {
    return {
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
      labelLink: {
        class: LabelLinkTool,
        config: {
          dataHogService: this.dh,
        },
      },
    };
  }

  constructor(
    private elementRef: ElementRef,
    private dh: DataHogService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    // Subscribe to route parameter changes
    this.route.paramMap.subscribe(async (params) => {
      const nodeIDstr = params.get('nodeID');
      if (!nodeIDstr) {
        console.error('No nodeID provided in route');
        this.router.navigate(['/']);
        return;
      }

      try {
        const node = await this.dh.getNode(NodeID.fromString(nodeIDstr));
        if (node.kind !== 'MimeType(Markdown)') {
          this.router.navigate(['/node', nodeIDstr]);
          return;
        }
        // Clean up existing editor before loading new node
        this.editor?.destroy();

        this.node = undefined; // Reset to show loading state
        this.cdr.detectChanges();
        setTimeout(async () => {
          this.node = node;
        });
      } catch (error) {
        console.error(`Failed to parse nodeID: ${error}`);
        return;
      }
    });
  }

  ngOnDestroy() {
    this.editor?.destroy();
  }

  private async startEditor(holder?: ElementRef<HTMLHtmlElement>) {
    if (!this.node || !holder) {
      return;
    }

    // Configure LabelLinkTool with DataHogService
    LabelLinkTool.configure(this.dh);

    this.editor = await this.initializeEditor(
      holder,
      {
        blocks: DataHogService.dataNodeToBlocks(this.node!.dataNode),
      },
      this.getTextTools(),
      async (api, _) => {
        const blocks = (await api.saver.save()).blocks;
        const dn = DataHogService.blocksToDataNode(blocks);
        this.node!.dataNode = dn;
        await this.dh.updateNode(this.node!);
      },
    );
    setTimeout(() => this.editor!.focus(), 10);
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
        placeholder: `Start adding content`,
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
