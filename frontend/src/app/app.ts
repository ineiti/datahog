import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import init, { Datahog, Transaction } from 'datahog-npm';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('frontend');

  ngOnInit() {
    const url = new URL('datahog_npm_bg.wasm', import.meta.url);
    const sub = new Subject();
    sub.subscribe((s) => {
      console.log(`Got ${s}`);
    })
    init(url).then(() => {
      Datahog.new().then((dh) => {
        dh.add_callback((f: Transaction) => {
          console.log(`Callback called with ${f.timestamp}`);
        })
      })
    }).catch((e) => { console.error(e); })
  }
}
