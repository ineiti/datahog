import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import init, { Datahog, new_dh } from 'datahog-npm';

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
    init(url).then(() => {
      let dh = Datahog.new();
      console.log(dh.increase());
      console.log(dh.increase());
      console.log(dh.increase());
    }).catch((e) => { console.error(e); })
  }
}
