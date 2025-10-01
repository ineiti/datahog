# Overview

While there is a classical backend/frontend separation, it follows the work done
in [Livequiz](https://github.com/ineiti/livequiz), where the backend merely
serves and stores the updates in a log system:

- [datahog](./datahog) - handles the objects (nodes and edges):
  - updates with transactions from the backend
  - sending changes through transactions to the backend
- [backend](./backend) is composed of a rocket server handling all requests, using the
common code
- [npm-wasm](./npm-wasm) builds the npm-package with the common code, including communication
with the backend
- [frontend](./frontend) is an angular application communicating with the backend with
extensive use of rxjs. It uses npm-wasm.

CURRENTLY THERE IS NO ACCESS CONTROL IMPLEMENTED, SO ONLY RUN THIS LOCALLY!

## Backend
