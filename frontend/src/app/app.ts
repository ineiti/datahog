import { Basic } from './view/basic/basic';
import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DataHogService } from './data-hog';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Basic],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('frontend');

  constructor(private dh: DataHogService) {}

  async ngOnInit() {
    return new Promise((res) => {
      this.dh.done.subscribe(() => {
        console.log('Initialized dh');
        res(true);
        this.dh.getNode(this.dh.rootNodeID).then((root) => {
          console.log(`got node ${this.dh.rootNodeID}: ${root}`);
        });
      });
    });
  }
}
