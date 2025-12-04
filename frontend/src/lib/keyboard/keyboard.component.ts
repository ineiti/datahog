import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ContextMenu } from 'primeng/contextmenu';
import { MenuItem } from 'primeng/api';
import { DataHogService } from '../../app/data-hog';
import { Node } from 'datahog-npm';

@Component({
  selector: 'lib-keyboard',
  standalone: true,
  imports: [ContextMenu],
  templateUrl: './keyboard.component.html',
  styleUrl: './keyboard.component.scss',
})
export class KeyboardComponent {
  @ViewChild('cm') contextMenu?: ContextMenu;
  items: MenuItem[] = [
    { label: 'Label', command: () => this.newNode('Label') },
    { label: 'Markdown', command: () => this.newNode('Markdown') },
    { label: 'Schema', command: () => this.newNode('Schema') },
  ];

  constructor(
    private elementRef: ElementRef,
    private router: Router,
    private dh: DataHogService,
  ) {}

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (event.altKey) {
      switch (event.code) {
        case 'KeyN':
          this.omitCombined(() => this.contextMenu!.show(event));
          return false;
      }
    }
    return true;
  }

  private omitCombined(cb: () => void) {
    this.elementRef.nativeElement.querySelector('#hidden')!.focus();
    setTimeout(() => {
      cb();
    }, 10);
  }

  private async newNode(type: string) {
    let node: Node | undefined;
    switch (type) {
      case 'Label':
        node = Node.new_label('Label');
        break;
      case 'Markdown':
        node = Node.new_mime('Label MD', 'Markdown');
        break;
      case 'Schema':
        node = Node.new_schema('Label schema');
        break;
      default:
        return;
    }
    await this.dh.updateNode(node);
    // Navigate to the newly created node
    await this.router.navigate(['/node', node.id.toString()]);
  }
}
