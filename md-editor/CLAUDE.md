# MD-Editor

A block-based markdown editor with mixed display mode (Obsidian-style): markdown source is edited and stored, but displayed as HTML. Markdown syntax becomes visible only when the cursor is active in that element.

**Architecture**: Framework-agnostic vanilla TypeScript library (similar to EditorJS) that can be used with any framework including Angular, React, Vue, or plain JavaScript. Uses RxJS for state management and vanilla DOM manipulation for rendering.

**Distribution**: Standalone npm package (`@datahog/md-editor`) located in `/md-editor` directory at the project root. Can be installed as a dependency in the frontend or any other project.

# Important Files

- [./PLAN.md] - when asked to progress to the next phase, use the plan. It defines the phases of the implementation
- [./TODO.md] - outstanding things to do for finishing the current phase.

Current Phase: "Phase 2"

## TODO file

When working on an item in the TODO.md file, only work on one item at the time.
Once you did one item, I'll test it, give you feedback, until it's done.
When the item is done, I'll remove it from the TODO.md, commit, and ask you to go on.

# Development Steps

After every change to the code, run `npm run build` to make sure there are no errors in the code, and to
update the current page.

# Code Writing

Comments: do not comment lines which are obviously understandable.
Comment larger blocks of code to explain what 10-20 lines are doing.
For function / class comments, explain what is not readily understandable
when reading the method / class name.
