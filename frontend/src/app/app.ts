import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import init, { Datahog, Transaction } from 'datahog-npm';
import { Subject } from 'rxjs';
import { DataHogService } from './data-hog';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('frontend');

  constructor(private dh: DataHogService) { }

  async ngOnInit() {
    return new Promise((res) => {
      this.dh.done.subscribe(() => {
        console.log("Initialized dh");
        res(true);
        this.dh.getNode(this.dh.rootNodeID).then((root) => {
          console.log(`got node ${this.dh.rootNodeID}`);
          root.subscribe((node) => {
            console.log(`Updated node ${node}`);
          })
        })
      })
    })
  }
}
