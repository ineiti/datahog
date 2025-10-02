# Next Steps

## First tests

- Create a directory with some simple .md files and PDFs taken from e-id/WP1
- Modify the `Node` and `Edge`, store, and verify result

## Frontend

- See if anything from `old.frontend` is useable

# History

## 2025-10-02

- worked on first implementation of `Node` and `Edge`, including Transactions.

## 2025-10-01

- started to implement the datahog/src/storage with a `dir_trait` and a first `disk` implementation

## 2025-08-27

### wasm-pack

- compile datahog to npm-wasm
- use npm-wasm in frontend
- TODO:
  - fix bug of `readonly __wbgt__flarch::tasks::wasm::test_interval: (a: number) => void;`
    created by `wasm-pack build --target web`
    - remove the test from flarch?
  - why do we need to call `init(new URL...)`, and the wasm-file is not put in the
    angular/vite directory?
  - make sure files are correctly distributed in datahog/backend/npm-wasm
  - make the storage working
  - think how `WorldView` should look to make it usable both for the frontend and the backend
    - is it needed on the backend?

## 2025-08-21

### Backend / wasm / frontend

- Creating structure with common code, backend, wasm-library, and angular
- Last action: created default angular app
