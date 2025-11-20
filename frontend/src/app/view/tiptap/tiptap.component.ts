import { Component, OnInit, OnDestroy, ElementRef } from '@angular/core';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Instance as TippyInstance } from 'tippy.js';

interface CommandItem {
  title: string;
  description: string;
  icon: string;
  command: (props: { editor: Editor; range: { from: number; to: number } }) => void;
  keywords?: string[];
}

@Component({
  selector: 'app-tiptap',
  standalone: true,
  templateUrl: './tiptap.component.html',
  styleUrl: './tiptap.component.scss',
})
export class TiptapComponent implements OnInit, OnDestroy {
  private editor: Editor | null = null;
  private popup: TippyInstance<any> | null = null;
  private commandItems: CommandItem[] = [];

  constructor(private elementRef: ElementRef) {}

  async ngOnInit() {
    await this.initializeEditor();
  }

  ngOnDestroy() {
    if (this.editor) {
      this.editor.destroy();
    }
    if (this.popup) {
      this.popup.destroy();
    }
  }

  private async initializeEditor() {
    const tippy = (await import('tippy.js')).default;

    const editorElement = this.elementRef.nativeElement.querySelector('#editor');
    if (!editorElement) {
      console.error('Editor element not found');
      return;
    }

    // Initialize command items
    this.commandItems = this.getCommandItems();

    // Create the editor with block editing support
    this.editor = new Editor({
      element: editorElement,
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3],
          },
        }),
      ],
      content: `
        <h1>Block Editor with Slash Commands</h1>
        <p>This is a simple block-based editor. Try these features:</p>
        <ul>
          <li>Type <strong>/</strong> to open the slash command menu</li>
          <li>Use arrow keys to navigate and Enter to select</li>
          <li>Click on blocks to edit them</li>
        </ul>
        <p>Start typing here...</p>
      `,
      editorProps: {
        attributes: {
          class: 'prose prose-sm sm:prose lg:prose-lg focus:outline-none',
        },
        handleKeyDown: (view, event) => {
          return this.handleKeyDown(view, event, tippy);
        },
      },
    });
  }

  private getCommandItems(): CommandItem[] {
    return [
      {
        title: 'Text',
        description: 'Start writing with plain text',
        icon: '📄',
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setParagraph().run();
        },
        keywords: ['p', 'paragraph'],
      },
      {
        title: 'Heading 1',
        description: 'Big section heading',
        icon: 'H1',
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
        },
        keywords: ['h1', 'heading', 'title'],
      },
      {
        title: 'Heading 2',
        description: 'Medium section heading',
        icon: 'H2',
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
        },
        keywords: ['h2', 'heading', 'subtitle'],
      },
      {
        title: 'Heading 3',
        description: 'Small section heading',
        icon: 'H3',
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
        },
        keywords: ['h3', 'heading', 'subheading'],
      },
      {
        title: 'Bullet List',
        description: 'Create a simple bullet list',
        icon: '•',
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleBulletList().run();
        },
        keywords: ['ul', 'unordered', 'list'],
      },
      {
        title: 'Numbered List',
        description: 'Create a numbered list',
        icon: '1.',
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleOrderedList().run();
        },
        keywords: ['ol', 'ordered', 'list', 'numbered'],
      },
      {
        title: 'Quote',
        description: 'Capture a quote',
        icon: '❝',
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleBlockquote().run();
        },
        keywords: ['blockquote', 'cite'],
      },
      {
        title: 'Code Block',
        description: 'Display code with syntax highlighting',
        icon: '</>',
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
        },
        keywords: ['code', 'pre', 'monospace'],
      },
      {
        title: 'Divider',
        description: 'Visually divide blocks',
        icon: '—',
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).setHorizontalRule().run();
        },
        keywords: ['hr', 'horizontal', 'rule', 'separator'],
      },
    ];
  }

  private handleKeyDown(view: any, event: KeyboardEvent, tippy: any): boolean {
    // Handle slash command trigger
    if (event.key === '/' && !this.popup) {
      const { from } = view.state.selection;
      const textBefore = view.state.doc.textBetween(Math.max(0, from - 1), from);

      // Only trigger if slash is at start of line or after space
      if (textBefore === '' || textBefore === ' ') {
        setTimeout(() => this.showCommandMenu(from, tippy, view), 0);
      }
    }

    return false;
  }

  private showCommandMenu(from: number, tippy: any, view: any) {
    if (!this.editor) return;

    let filteredItems = [...this.commandItems];
    let selectedIndex = 0;

    // Create command menu element
    const menuElement = document.createElement('div');
    menuElement.className = 'slash-menu';

    const renderMenu = () => {
      menuElement.innerHTML = filteredItems
        .map(
          (item, index) => `
          <div class="slash-menu-item ${index === selectedIndex ? 'selected' : ''}" data-index="${index}">
            <div class="icon">${item.icon}</div>
            <div class="content">
              <div class="title">${item.title}</div>
              <div class="description">${item.description}</div>
            </div>
          </div>
        `
        )
        .join('');

      // Add click handlers after rendering
      menuElement.querySelectorAll('.slash-menu-item').forEach((el) => {
        el.addEventListener('click', () => {
          const index = parseInt((el as HTMLElement).dataset['index'] || '0');
          this.executeCommand(filteredItems[index], from);
        });
      });
    };

    renderMenu();

    // Create tippy popup
    this.popup = tippy(document.body, {
      getReferenceClientRect: () => {
        const coords = view.coordsAtPos(from);
        return {
          width: 0,
          height: 0,
          top: coords.top,
          bottom: coords.bottom,
          left: coords.left,
          right: coords.left,
          x: coords.left,
          y: coords.top,
          toJSON: () => ({}),
        };
      },
      appendTo: () => document.body,
      content: menuElement,
      showOnCreate: true,
      interactive: true,
      trigger: 'manual',
      placement: 'bottom-start',
      theme: 'light',
    });

    // Keyboard navigation
    const handleMenuKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % filteredItems.length;
        renderMenu();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = selectedIndex === 0 ? filteredItems.length - 1 : selectedIndex - 1;
        renderMenu();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.executeCommand(filteredItems[selectedIndex], from);
        document.removeEventListener('keydown', handleMenuKeyDown);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.closeMenu();
        document.removeEventListener('keydown', handleMenuKeyDown);
      } else if (e.key.length === 1 || e.key === 'Backspace') {
        // Filter commands based on typed text
        setTimeout(() => {
          if (!this.editor) return;

          const state = this.editor.state;
          const searchText = state.doc
            .textBetween(from + 1, state.selection.from)
            .toLowerCase();

          filteredItems = this.commandItems.filter((item) => {
            const searchIn = [
              item.title.toLowerCase(),
              item.description.toLowerCase(),
              ...(item.keywords || []),
            ].join(' ');
            return searchIn.includes(searchText);
          });

          selectedIndex = 0;

          if (filteredItems.length === 0 || searchText.includes(' ')) {
            this.closeMenu();
            document.removeEventListener('keydown', handleMenuKeyDown);
          } else {
            renderMenu();
          }
        }, 0);
      }
    };

    document.addEventListener('keydown', handleMenuKeyDown);

    // Close on click outside
    const closeOnClickOutside = (e: MouseEvent) => {
      if (!menuElement.contains(e.target as Node)) {
        this.closeMenu();
        document.removeEventListener('click', closeOnClickOutside);
        document.removeEventListener('keydown', handleMenuKeyDown);
      }
    };
    setTimeout(() => document.addEventListener('click', closeOnClickOutside), 0);
  }

  private executeCommand(command: CommandItem, from: number) {
    if (!this.editor) return;

    const to = this.editor.state.selection.from;
    command.command({ editor: this.editor, range: { from, to } });
    this.closeMenu();
  }

  private closeMenu() {
    if (this.popup) {
      this.popup.destroy();
      this.popup = null;
    }
  }
}
