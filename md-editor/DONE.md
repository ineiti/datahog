# Phase 2

- Examples
please add an index.html with links to the different example pages

- Block editing 3
current: 'delete' at the end of the block is ignored
wanted: 'delete' at the end of the block merges the block below and keeps the cursor at the same position

- Block editing 2
current: when pressing enter after the first word in the block "text# heading", so that the second
block is "# heading", the "# heading" is not interpreted and stays as a paragraph.
wanted: "# heading" at the beginning of a paragraph should be interpreted as a heading. 
Except for lists, where it should still create a "- # heading" entry.

- Block editing 1
current: when 'enter' is pressed anywhere in the block, a new empty block is created
wanted: when 'enter' is pressed, the part to the right of the cursor must be moved to the new block

- Phase2.html
current: Uncaught (in promise) ReferenceError: Cannot access 'editor' before initialization
    at Object.onReady (phase2.html:262:26)
    at MarkdownEditor.initialize (MarkdownEditor.ts:92:19)
    at new MarkdownEditor (MarkdownEditor.ts:40:10)
    at phase2.html:242:20
wanted: no error

- List improvement 3
current: when an unordered list is followed by a counting list, the counting list includes the unordered list in its count. In the "Phase 2" example, the counting list starts at 5.
wanted: in the "Phase 2" example, the counting list should start at 1

- List improvement 2
current: lots of space between list elements
wanted: make list elements closer to each other

- List improvement 1
current: when in a list element, '-' or '1.', and pressing enter, a paragraph block is created
wanted: when pressing enter in a list element, a new list element should appear
