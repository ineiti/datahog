import { Component, OnDestroy } from '@angular/core';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Instance as TippyInstance } from 'tippy.js';

@Component({
  selector: 'tiptap-editor',
  imports: [],
  templateUrl: './tiptap-editor.html',
  styleUrl: './tiptap-editor.scss',
})
export class TipTapEditor implements OnDestroy {
  private editor: Editor | null = null;
  private popup: TippyInstance<any> | null = null;

  async ngOnInit() {
    console.log('Initializing TipTap editor with slash commands');
    this.initializeTipTap();
  }

  ngOnDestroy() {
    if (this.editor) {
      this.editor.destroy();
    }
    if (this.popup) {
      this.popup.destroy();
    }
  }

  private async initializeTipTap() {
    // Dynamically import tippy.js
    const tippy = (await import('tippy.js')).default;

    const editorElement = document.getElementById('tiptap-editor');
    if (!editorElement) {
      console.error('Editor element not found');
      return;
    }

    // Command items for slash menu
    const commandItems = [
      {
        title: 'Heading 1',
        command: ({ editor, range }: any) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .setNode('heading', { level: 1 })
            .run();
        },
      },
      {
        title: 'Heading 2',
        command: ({ editor, range }: any) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .setNode('heading', { level: 2 })
            .run();
        },
      },
      {
        title: 'Heading 3',
        command: ({ editor, range }: any) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .setNode('heading', { level: 3 })
            .run();
        },
      },
      {
        title: 'Bullet List',
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).toggleBulletList().run();
        },
      },
      {
        title: 'Numbered List',
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).toggleOrderedList().run();
        },
      },
      {
        title: 'Quote',
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).toggleBlockquote().run();
        },
      },
      {
        title: 'Code Block',
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
        },
      },
    ];

    // Create the editor
    this.editor = new Editor({
      element: editorElement,
      extensions: [StarterKit],
      content: '<p>Type "/" to see slash commands...</p>',
      editorProps: {
        handleKeyDown: (view, event) => {
          // Handle slash command trigger
          if (event.key === '/' && !this.popup) {
            const { from } = view.state.selection;

            // Create command menu
            const commandListElement = document.createElement('div');
            commandListElement.className = 'slash-command-menu';

            let filteredItems = [...commandItems];
            let selectedIndex = 0;

            const renderMenu = (items: typeof commandItems) => {
              commandListElement.innerHTML = items
                .map((item, index) => {
                  const isSelected = index === selectedIndex;
                  return `<div class="command-item ${isSelected ? 'selected' : ''}" data-index="${index}">
                    ${item.title}
                  </div>`;
                })
                .join('');
            };

            renderMenu(filteredItems);

            // Create tippy popup
            this.popup = tippy(document.body, {
              getReferenceClientRect: () => {
                const { node } = view.domAtPos(from);
                if (node instanceof Element) {
                  return node.getBoundingClientRect();
                }
                return new DOMRect();
              },
              appendTo: () => document.body,
              content: commandListElement,
              showOnCreate: true,
              interactive: true,
              trigger: 'manual',
              placement: 'bottom-start',
            });

            // Add click handlers
            commandListElement.addEventListener('click', (e) => {
              const target = e.target as HTMLElement;
              const item = target.closest('.command-item') as HTMLElement;
              if (item) {
                const index = parseInt(item.dataset['index'] || '0');
                const selectedCommand = filteredItems[index];
                if (selectedCommand && this.editor) {
                  selectedCommand.command({
                    editor: this.editor,
                    range: { from: from, to: from + 1 },
                  });
                  this.popup?.destroy();
                  this.popup = null;
                }
              }
            });

            // Handle arrow keys and enter
            const handleMenuKeyDown = (e: KeyboardEvent) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = (selectedIndex + 1) % filteredItems.length;
                renderMenu(filteredItems);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = selectedIndex === 0 ? filteredItems.length - 1 : selectedIndex - 1;
                renderMenu(filteredItems);
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const selectedCommand = filteredItems[selectedIndex];
                if (selectedCommand && this.editor) {
                  selectedCommand.command({
                    editor: this.editor,
                    range: { from: from, to: from + 1 },
                  });
                  this.popup?.destroy();
                  this.popup = null;
                  document.removeEventListener('keydown', handleMenuKeyDown);
                }
              } else if (e.key === 'Escape') {
                e.preventDefault();
                this.popup?.destroy();
                this.popup = null;
                document.removeEventListener('keydown', handleMenuKeyDown);
              } else if (e.key.length === 1 || e.key === 'Backspace') {
                // Filter commands based on input
                setTimeout(() => {
                  const { state } = view;
                  const text = state.doc.textBetween(from + 1, state.selection.from);
                  filteredItems = commandItems.filter((item) =>
                    item.title.toLowerCase().includes(text.toLowerCase())
                  );
                  selectedIndex = 0;

                  if (filteredItems.length === 0) {
                    this.popup?.destroy();
                    this.popup = null;
                    document.removeEventListener('keydown', handleMenuKeyDown);
                  } else {
                    renderMenu(filteredItems);
                  }
                }, 0);
              }
            };

            document.addEventListener('keydown', handleMenuKeyDown);

            // Close menu on click outside
            const closeOnClickOutside = (e: MouseEvent) => {
              if (!commandListElement.contains(e.target as Node)) {
                this.popup?.destroy();
                this.popup = null;
                document.removeEventListener('click', closeOnClickOutside);
                document.removeEventListener('keydown', handleMenuKeyDown);
              }
            };
            setTimeout(() => document.addEventListener('click', closeOnClickOutside), 0);
          }

          return false;
        },
      },
    });
  }
}
