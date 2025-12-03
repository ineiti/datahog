import { Component, HostListener, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
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
    private route: ActivatedRoute,
  ) {}

  async ngOnInit() {
    return new Promise((res) => {
      this.dh.done.subscribe(() => {
        res(true);
        this.initialized = true;
      });
    });
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (event.altKey) {
      switch (event.code) {
        case 'KeyF':
          this.router.navigate(['/']);
          return false;
        case 'KeyN':
          this.navigateToNodeView();
          return false;
        case 'KeyM':
          this.navigateToMarkdown();
          return false;
      }
    }

    return true;
  }

  private navigateToNodeView() {
    // Get the current URL and extract nodeID if present
    const url = this.router.url;
    const nodeIDMatch = url.match(/\/(node|markdown)\/([^\/]+)/);

    if (nodeIDMatch && nodeIDMatch[2]) {
      const nodeID = nodeIDMatch[2];
      this.router.navigate(['/node', nodeID]);
    }
  }
  private navigateToMarkdown() {
    // Get the current URL and extract nodeID if present
    const url = this.router.url;
    const nodeIDMatch = url.match(/\/(node|markdown)\/([^\/]+)/);

    if (nodeIDMatch && nodeIDMatch[2]) {
      const nodeID = nodeIDMatch[2];
      this.router.navigate(['/markdown', nodeID]);
    }
  }
}
