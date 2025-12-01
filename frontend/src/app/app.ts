import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DataHogService } from './data-hog';
import { nodeComponent } from './view/node/node.component';
import { Node } from 'datahog-npm';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, nodeComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('frontend');
  protected readonly rootNode = signal<Node | null>(null);

  constructor(private dh: DataHogService) {}

  async ngOnInit() {
    return new Promise((res) => {
      this.dh.done.subscribe(() => {
        res(true);
        this.dh.getNode(this.dh.rootNodeID).then((root) => {
          this.rootNode.set(root);
        });
      });
    });
  }
}
