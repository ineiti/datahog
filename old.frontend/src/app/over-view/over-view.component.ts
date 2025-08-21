import { Component, inject, ViewChild } from '@angular/core';
import { NetworkGraphComponent } from '../network-graph/network-graph.component';
import { Edge, Node, Options } from 'vis-network/standalone';
import { Data, DataService } from '../data.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-over-view',
  imports: [NetworkGraphComponent],
  templateUrl: './over-view.component.html',
  styleUrl: './over-view.component.scss'
})
export class OverViewComponent {
  @ViewChild(NetworkGraphComponent) networkComponent!: NetworkGraphComponent;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private dataService = inject(DataService);

  nodes: Node[] = [];
  edges: Edge[] = [];
  options: Options = {
    nodes: {
      borderWidth: 2,
      borderWidthSelected: 4,
    },
    layout: {
      improvedLayout: true
    }
  };

  ngOnInit() {
    this.ngOnChanges();
  }

  ngOnChanges() {
    const root = this.route.snapshot.paramMap.get('nodeID');
    if (root) {
      this.loadData(root);
    } else {
      this.navigateRoot();
    }
  }

  loadData(root: string) {
    this.nodes = [];
    this.edges = [];
    const datas = [this.dataService.entries.get(root)];
    let data: Data | undefined;
    while (data = datas.pop()) {
      this.nodes.push(data.getNode());
      for (const link of data.links) {
        this.edges.push({
          from: data.id,
          to: link.to
        });
        const to = this.dataService.entries.get(link.to);
        if (to && !this.nodes.some((node) => node.id === to.id)) {
          datas.push(to);
        }
      }
    }
  }

  navigateRoot() {
    let root = [...this.dataService.entries.values()].find((value) => value.label === "Root");
    if (!root) {
      console.error("Root not found");
      return;
    }
    this.router.navigate(["over-view", root.id]);
  }

  // Fit network view
  fitNetwork() {
    this.networkComponent.fit();
  }
}
