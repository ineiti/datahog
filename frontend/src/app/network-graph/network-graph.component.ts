import { Component, ElementRef, OnInit, OnDestroy, ViewChild, Input, OnChanges, SimpleChanges, HostListener, inject } from '@angular/core';
import { Network, DataSet, Node, Edge, Options } from 'vis-network/standalone';
import { Data, DataCheckbox, DataLabel, DataMarkdown, DataService, DataView } from '../data.service';
import { MatDialog } from '@angular/material/dialog';
import { NodeEditorComponent } from '../node-editor/node-editor.component';

@Component({
  selector: 'app-network-graph',
  templateUrl: './network-graph.component.html',
  styleUrls: ['./network-graph.component.scss']
})
export class NetworkGraphComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('networkContainer', { static: true }) networkContainer!: ElementRef;

  @Input() nodes: any[] = [];
  @Input() edges: any[] = [];
  @Input() options: Options = {};

  private network: Network | null = null;
  private nodesDataSet: DataSet<Node> | null = null;
  private edgesDataSet: DataSet<Edge> | null = null;
  private addingEdge?: "contains" | "isA";
  private addingEdgeSrc?: string;

  dialog = inject(MatDialog);

  constructor(private data: DataService) { }

  ngOnInit(): void {
    this.initNetwork();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Update the network when inputs change
    if ((changes['nodes'] || changes['edges']) && this.nodesDataSet && this.edgesDataSet) {
      if (changes['nodes']) {
        this.nodesDataSet.update(this.nodes);
      }

      if (changes['edges']) {
        this.edgesDataSet.update(this.edges);
      }
    }

    // If options change, re-initialize the network
    if (changes['options'] && !changes['options'].firstChange) {
      this.initNetwork();
    }
  }

  private initNetwork(): void {
    // Create data sets
    this.nodesDataSet = new DataSet<Node>(this.nodes);
    this.edgesDataSet = new DataSet<Edge>(this.edges);

    // Default options if none provided
    const defaultOptions: Options = {
      nodes: {
        shape: 'circle',
        borderWidth: 2,
        borderWidthSelected: 4,
        color: {
          border: '#2B7CE9',
          background: '#97C2FC',
          highlight: {
            border: '#2B7CE9',
            background: '#D2E5FF'
          },
          hover: {
            border: '#007CE9',
            background: '#00E5FF'
          }
        }
      },
      edges: {
        color: {
          color: '#848484',
          highlight: '#848484',
          hover: '#848484'
        }
      },
      physics: {
        enabled: true,
        hierarchicalRepulsion: {
          centralGravity: 0.0,
          springLength: 100,
          springConstant: 0.01,
          nodeDistance: 120,
          damping: 0.09,
          avoidOverlap: 0
        },
      },
      interaction: {
        hover: true,
      }
    };

    // Destroy previous network instance if it exists
    if (this.network) {
      this.network.destroy();
    }

    // Merge provided options with defaults
    const mergedOptions = { ...defaultOptions, ...this.options };

    // Create the network
    const container = this.networkContainer.nativeElement;
    this.network = new Network(
      container,
      { nodes: this.nodesDataSet, edges: this.edgesDataSet },
      mergedOptions
    );

    // Add event listeners if needed
    this.network.on('click', (params) => {
      if (params.event && params.event.srcEvent) {
        if (this.addingEdge) {
          document.getElementById("network-container")!.style!.cursor = "auto";
          if (this.addingEdgeSrc && params.nodes.length > 0) {
            const targetNodeId = params.nodes[0];
            const sourceNode = this.data.entries.get(this.addingEdgeSrc);
            if (sourceNode?.links.some(link => link.to === targetNodeId)) {
              console.log("Link already exists");
            } else {
              sourceNode?.links.push({ to: targetNodeId, linkType: this.addingEdge });
              this.data.setData(sourceNode!);
              this.edgesDataSet?.add({ from: this.addingEdgeSrc, to: targetNodeId });
            }
          }
          this.addingEdge = undefined;
          return;
        }
        if (params.nodes.length > 0) {
          const { clientX, clientY } = params.event.srcEvent;
          this.createContextMenu(params.nodes[0], clientX, clientY);
        } else if (params.edges.length > 0) {
          const edgeId: string = params.edges[0];
          const edgeData = this.edgesDataSet?.get(edgeId);
          if (edgeData && confirm("Are you sure you want to remove this edge?")) {
            this.edgesDataSet?.remove(edgeId);
            console.log(edgeData);
            const sourceNode = this.data.entries.get(edgeData!.from!.toString());
            if (sourceNode) {
              sourceNode.links = sourceNode.links.filter(link => link.to !== edgeData!.to!.toString());
              this.data.setData(sourceNode);
            }
          }
        }
      }
    });
  }

  private createContextMenu(node: Node, x: number, y: number): void {
    // Remove any existing menu
    const existingMenu = document.getElementById('network-context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }

    // Create the menu container
    const menu = document.createElement('div');
    menu.id = 'network-context-menu';
    menu.style.position = 'absolute';

    // Ensure the menu stays visible within the viewport
    setTimeout(() => {
      const menuRect = menu.getBoundingClientRect();
      if (menuRect.right > window.innerWidth) {
        menu.style.left = `${window.innerWidth - menuRect.width - 5}px`;
      }
      if (menuRect.bottom > window.innerHeight) {
        menu.style.top = `${window.innerHeight - menuRect.height - 5}px`;
      }
    }, 0);
    menu.style.top = `${y - 5}px`;
    menu.style.left = `${x - 5}px`;
    menu.style.backgroundColor = '#fff';
    menu.style.border = '1px solid #ccc';
    menu.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
    menu.style.padding = '10px';
    menu.style.zIndex = '1000';

    // Menu structure
    menu.innerHTML = `
      <ul style="list-style: none; margin: 0; padding: 0;">
        <li style="margin-bottom: 5px; cursor: pointer;">Show</li>
        <li style="margin-bottom: 5px; cursor: pointer;">Edit</li>
        <li style="margin-bottom: 5px; cursor: pointer;">Add Node
          <ul style="list-style: none; margin: 5px 0 0 15px; padding: 0;">
            <li style="cursor: pointer;">View</li>
            <li style="cursor: pointer;">Label</li>
            <li style="cursor: pointer;">Checkbox</li>
            <li style="cursor: pointer;">Markdown</li>
          </ul>
        </li>
        <li style="cursor: pointer;">Link
          <ul style="list-style: none; margin: 5px 0 0 15px; padding: 0;">
            <li style="cursor: pointer;">Contains</li>
            <li style="cursor: pointer;">Is-a</li>
          </ul>
        </li>
        <li style="margin-bottom: 5px; cursor: pointer;">Delete</li>
      </ul>
    `;

    // Append the menu to the body
    document.body.appendChild(menu);

    // Add event listener to close the menu on click outside
    const closeMenu = (event: MouseEvent) => {
      if (menu.contains(event.target as globalThis.Node)) {
        console.log("Clicked inside menu");
        const targetElement = event.target as HTMLElement;
        if (targetElement instanceof HTMLLIElement) {
          const nodeId = node.toString(); // Assuming 'node' holds the ID
          let data = this.data.entries.get(nodeId);
          if (!data) {
            console.error("Data not found for node ID:", nodeId);
          } else {
            let newData: Data | undefined = undefined;
            switch (targetElement.textContent?.trim()) {
              case "Show":

                break;
              case "Edit":
                this.dialog.open(NodeEditorComponent, { data }).afterClosed().subscribe(_ => {
                  this.nodesDataSet?.update(data.getNode());
                });

                break;
              case "Delete":
                if (confirm("Are you sure you want to delete this node?")) {
                  this.nodesDataSet?.remove(nodeId);
                  this.data.rmData(nodeId);
                }
                break;
              case "View":
                newData = this.data.setData(new DataView("graph", "", "View").newData("View", []));
                break;
              case "Label":
                newData = this.data.setData(new DataLabel("Label").newData("Label", []));
                break;
              case "Checkbox":
                newData = this.data.setData(new DataCheckbox("Checkbox", false).newData("Checkbox", []));
                break;
              case "Markdown":
                newData = this.data.setData(new DataMarkdown("Markdown").newData("Markdown", []));
                break;
              case "Contains":
                this.addingEdge = "contains";
                this.addingEdgeSrc = nodeId;
                break;
              case "Is-a":
                this.addingEdge = "isA";
                this.addingEdgeSrc = nodeId;
                break;
              default: return;
            }
            if (this.addingEdge) {
              document.getElementById("network-container")!.style!.cursor = "crosshair";
            } else {
              if (newData) {
                this.dialog.open(NodeEditorComponent, { data: newData }).afterClosed().subscribe(_ => {
                  data.links.push({ to: newData.id, linkType: "contains" });
                  this.nodesDataSet?.update(newData.getNode());
                  this.edgesDataSet?.update({ from: nodeId, to: newData.id });
                  this.data.setData(data);
                  this.data.setData(newData);
                });
              }
            }
          }
        }
      }
      menu.remove();
      document.removeEventListener('mousedown', closeMenu);
    };
    document.addEventListener('mousedown', closeMenu);
  }

  ngOnDestroy(): void {
    // Clean up network when component is destroyed
    if (this.network) {
      this.network.destroy();
      this.network = null;
    }
  }

  // Add to network-graph.component.ts
  @HostListener('window:resize', ['$event'])
  onResize(event: Event): void {
    if (this.network) {
      this.network.redraw();
    }
  }

  // Public method to fit the network view
  public fit(): void {
    if (this.network) {
      this.network.fit();
    }
  }

  // Get the underlying Network instance (useful for advanced operations)
  public getNetwork(): Network | null {
    return this.network;
  }
}