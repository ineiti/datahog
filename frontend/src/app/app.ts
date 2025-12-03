import { Component, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { DataHogService } from './data-hog';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  initialized = false;
  protected readonly title = signal('frontend');

  constructor(
    private dh: DataHogService,
    private router: Router,
  ) {}

  async ngOnInit() {
    return new Promise((res) => {
      this.dh.done.subscribe(() => {
        res(true);
        this.initialized = true;
      });
    });
  }
}
