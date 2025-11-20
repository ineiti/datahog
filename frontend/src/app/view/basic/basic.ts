import { Component } from '@angular/core';
// Need to go through list of https://medevel.com/notion-style-editors-21991/

// Yoopta - for react

// Trix -  https://github.com/basecamp/trix

// TinyMCE - need to check it out. No "/", but
import tinymce from 'tinymce';

// Lexical - seems to be nice, but I cannot get it to work with slash and other
// stuff.
// Not sure if it only works with vite.
import { createEmptyHistoryState, registerHistory } from '@lexical/history';
import { HeadingNode, QuoteNode, registerRichText } from '@lexical/rich-text';
import { mergeRegister } from '@lexical/utils';
import { createEditor, HISTORY_MERGE_TAG } from 'lexical';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { $createParagraphNode, $createTextNode, $getRoot } from 'lexical';

// BlockSuite - has typos in it and doesn't work
// import '@blocksuite/presets/themes/affine.css';
// import { AffineSchemas } from '@blocksuite/blocks';
// import { AffineEditorContainer } from '@blocksuite/presets';
// import { Schema } from '@blocksuite/store';
// import { DocCollection, Text } from '@blocksuite/store';

// CodeMirror
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import '@blocknote/mantine/style.css';
import '@blocknote/core/fonts/inter.css';

// Blocknote
import { BlockNoteEditor } from '@blocknote/core';

@Component({
  selector: 'view-basic',
  imports: [],
  templateUrl: './basic.html',
  styleUrl: './basic.scss',
})
export class Basic {
  editor: HTMLElement | null = null;

  async ngOnInit() {
    console.log('View-basic 2');
    this.editor = document.getElementById('editor');
    this.blocknote();
  }

  blocknote() {
    const editor = BlockNoteEditor.create();
    editor.mount(document.getElementById('editor')!); // element to append the editor to
  }

  tinyMCE() {
    tinymce.PluginManager.add('slashcommands', function (editor) {
      var insertActions = [
        {
          text: 'Heading 1',
          icon: 'h1',
          action: function () {
            editor.execCommand('mceInsertContent', false, '<h1>Heading 1</h1>');
            editor.selection.select(editor.selection.getNode());
          },
        },
        {
          text: 'Heading 2',
          icon: 'h2',
          action: function () {
            editor.execCommand('mceInsertContent', false, '<h2>Heading 2</h2>');
            editor.selection.select(editor.selection.getNode());
          },
        },
        {
          text: 'Heading 3',
          icon: 'h3',
          action: function () {
            editor.execCommand('mceInsertContent', false, '<h3>Heading 3</h3>');
            editor.selection.select(editor.selection.getNode());
          },
        },
        {
          type: 'separator',
        },
        {
          text: 'Bulleted list',
          icon: 'unordered-list',
          action: function () {
            editor.execCommand('InsertUnorderedList', false);
          },
        },
        {
          text: 'Numbered list',
          icon: 'ordered-list',
          action: function () {
            editor.execCommand('InsertOrderedList', false);
          },
        },
      ];

      // Register the slash commands autocompleter
      editor.ui.registry.addAutocompleter('slashcommands', {
        trigger: '/',
        minChars: 0,
        columns: 1,
        fetch: function (pattern) {
          const matchedActions = insertActions.filter(function (action) {
            return (
              action.type === 'separator' ||
              action.text!.toLowerCase().indexOf(pattern.toLowerCase()) !== -1
            );
          });

          return new Promise((resolve) => {
            var results = matchedActions.map(function (action) {
              return {
                meta: action,
                text: action.text,
                icon: action.icon,
                value: action.text,
                type: action.type,
              };
            });
            resolve(results as any);
          });
        },
        onAction: function (autocompleteApi, rng, action, meta) {
          editor.selection.setRng(rng);
          // Some actions don't delete the "slash", so we delete all the slash
          // command content before performing the action
          editor.execCommand('Delete');
          meta['action']();
          autocompleteApi.hide();
        },
      });
      return {};
    });

    tinymce.init({
      selector: 'textarea',
      plugins: 'slashcommands lists',
      height: 400,
    });
  }

  lexical() {
    /**
     * Copyright (c) Meta Platforms, Inc. and affiliates.
     *
     * This source code is licensed under the MIT license found in the
     * LICENSE file in the root directory of this source tree.
     *
     */
    function prepopulatedRichText() {
      const root = $getRoot();
      if (root.getFirstChild() !== null) {
        return;
      }

      const heading = $createHeadingNode('h1');
      heading.append($createTextNode('Welcome to the Vanilla JS Lexical Demo!'));
      root.append(heading);
      const quote = $createQuoteNode();
      quote.append(
        $createTextNode(
          `In case you were wondering what the text area at the bottom is – it's the debug view, showing the current state of the editor. `,
        ),
      );
      root.append(quote);
      const paragraph = $createParagraphNode();
      paragraph.append(
        $createTextNode('This is a demo environment built with '),
        $createTextNode('lexical').toggleFormat('code'),
        $createTextNode('.'),
        $createTextNode(' Try typing in '),
        $createTextNode('some text').toggleFormat('bold'),
        $createTextNode(' with '),
        $createTextNode('different').toggleFormat('italic'),
        $createTextNode(' formats.'),
      );
      root.append(paragraph);
    }

    document.querySelector<HTMLDivElement>('#editor')!.innerHTML = `
      <div>
        <h1>Lexical Basic - Vanilla JS</h1>
        <div class="editor-wrapper">
          <div id="lexical-editor" contenteditable></div>
        </div>
        <h4>Editor state:</h4>
        <textarea id="lexical-state"></textarea>
      </div>
    `;
    const editorRef = document.getElementById('lexical-editor');
    const stateRef = document.getElementById('lexical-state') as HTMLTextAreaElement;

    const initialConfig = {
      namespace: 'Vanilla JS Demo',
      // Register nodes specific for @lexical/rich-text
      nodes: [HeadingNode, QuoteNode],
      onError: (error: Error) => {
        throw error;
      },
      theme: {
        // Adding styling to Quote node, see styles.css
        quote: 'PlaygroundEditorTheme__quote',
      },
    };
    const editor = createEditor(initialConfig);
    editor.setRootElement(editorRef);

    // Registering Plugins
    mergeRegister(
      registerRichText(editor),
      registerHistory(editor, createEmptyHistoryState(), 300),
    );

    editor.update(prepopulatedRichText, { tag: HISTORY_MERGE_TAG });

    editor.registerUpdateListener(({ editorState }) => {
      stateRef!.value = JSON.stringify(editorState.toJSON(), undefined, 2);
    });
  }

  // blocksuite() {
  //   const schema = new Schema().register(AffineSchemas);
  //   const collection = new DocCollection({ schema });
  //   collection.meta.initialize();

  //   const doc = collection.createDoc();
  //   const editor = new AffineEditorContainer();
  //   editor.doc = doc;
  //   this.editor!.append(editor);

  //   function createDoc() {
  //     doc.load(() => {
  //       const pageBlockId = doc.addBlock('affine:page', {
  //         title: new Text('Test'),
  //       });
  //       doc.addBlock('affine:surface', {}, pageBlockId);
  //       const noteId = doc.addBlock('affine:note', {}, pageBlockId);
  //       doc.addBlock('affine:paragraph', { text: new Text('Hello World!') }, noteId);
  //     });
  //   }
  // }

  codemirror() {
    const editor = new EditorView({
      state: EditorState.create({
        extensions: [basicSetup, markdown()],
      }),
      parent: document.getElementById('editor')!,
    });
  }
}

/**
 * Blocksuite - typos in the library which have never been fixed.
 * BlockNote - seems to be cool, but react only
 * CodeMirror - seems to be the basis of Obsidian, but Deepseek's example is only Code
 * Lexical - should work, but doesn't :()
 * MdxEditor - no slash commands
 * TipTap - looks good, but slash-commands are paying
 */
