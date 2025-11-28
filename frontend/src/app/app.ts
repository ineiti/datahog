import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DataHogService } from './data-hog';
import { nodemdComponent } from './view/node_md/nodemd.component';
import { Node } from 'datahog-npm';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, nodemdComponent],
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
        console.log('Initialized dh');
        res(true);
        this.dh.getNode(this.dh.rootNodeID).then((root) => {
          console.log(`Root node is: ${root.to_string()}`);
          this.rootNode.set(root);
        });
      });
    });
  }
}
