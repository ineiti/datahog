# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DataHog is a Rust library for building and manipulating graph-based data structures. The library provides a flexible system for storing and querying relationships between nodes through a transaction-based architecture.

## Build and Test Commands

```bash
# Build the library
cargo build

# Build with optimizations
cargo build --release

# Run all tests
cargo test

# Run a specific test
cargo test test_name

# Run tests with output
cargo test -- --nocapture
```

## Architecture

### Core Data Model

The system is built around a **transaction-based graph database** where all changes are recorded as immutable transactions:

- **Transaction**: The fundamental storage unit containing timestamped records (src/structs.rs:20-25)
- **Node**: Represents data entities with three main kinds (src/structs.rs:47-67):
  - `Render`: Display nodes (Markdown, Graph, Tabular views)
  - `Label`: Categorization nodes
  - `Container`: Data-holding nodes with various types (Formatted, MimeType, Schema, Concrete)
- **Edge**: Connections between nodes with four types (src/structs.rs:84-93):
  - `Equality`: Links similar nodes
  - `Definition`: Object-to-label relationships
  - `Using`: Client-to-object relationships
  - `Contains`: Container-to-object relationships
- **WorldView**: Central coordinator managing multiple sources and maintaining consistent state (src/worldview.rs:14-20)

### Key Design Patterns

**Event Sourcing**: All changes are recorded as transactions with timestamps. The current state is derived by replaying transactions (src/worldview.rs:95-140).

**Multi-Source Architecture**: The `WorldView` aggregates data from multiple `Source` implementations, each with unique IDs (src/structs.rs:251-263).

**Version Management**: Nodes have `op_version` fields allowing evolving implementations while maintaining backward compatibility (src/structs.rs:58).

### Storage Layer

The storage module (src/storage/) provides abstraction for different backends:

- **dir_trait.rs**: Defines `Reader` and `Writer` traits for filesystem operations
- **disk.rs**: `SourceDisk` implementation that reads directory structures into the graph, with special handling for markdown files
- **EmulatedDir**: In-memory filesystem for testing (src/storage/dir_trait.rs:28-72)

### Data Flow

1. **Ingestion**: Sources provide transactions via `get_updates()` (src/structs.rs:255)
2. **Processing**: WorldView processes transactions through `do_tx()` (src/worldview.rs:95)
3. **State Update**: Nodes and edges are created/updated based on records (src/worldview.rs:100-137)
4. **History Tracking**: Each node/edge maintains full history via `RecordEvent` (src/structs.rs:96)

## Important Implementation Notes

### ID Generation

All IDs (NodeID, EdgeID, SourceID) are U256 hashes that should be globally unique. The `rnd()` method generates random IDs.

### Timestamps

Timestamps use nanoseconds since UNIX epoch as i128 (src/structs.rs:277), providing high precision for ordering events.

### DataHash Enum

Node data can be stored as either inline `Bytes` or external `Hash(U256)` for large objects (src/structs.rs:72-77).

### Validity Periods

Edges have validity periods (From/To/Period) allowing temporal relationships (src/structs.rs:191-196).

### Edge-Node Synchronization

When edges are created/updated/deleted, the WorldView automatically updates the `edges` field on associated nodes (src/worldview.rs:142-180).

## Development Notes

- The project uses `edition = "2024"` in Cargo.toml
- Async operations use `tokio` and `async-trait`
- Serialization via `serde` and custom `VersionedSerde` from `flmacro`
- Tests use `#[tokio::test]` for async tests
- Error handling uses `anyhow::Result`

## Areas Under Development

Several areas have `todo!()` markers indicating planned features:

- Edge update operations (src/impls.rs:113)
- Equality edge processing (src/worldview.rs:144, 162)
- Markdown processing (src/storage/disk.rs:113)
- Source write operations (src/storage/disk.rs:46)
- Source ID implementation (src/storage/disk.rs:51)
