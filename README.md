# DataHog

Datahog proposes a flexible data visualization and management system that allows users to organize, relate, and view information in multiple ways. The system supports various data types with different visualization options and user-defined relationships.

## Data Model

The database stores the following elements:

- **Data elements**: Can be markdown formatted text, URL links, CSV-formatted data, checkboxes, dates, ...
- **Binary files**: Stored on the filesystem with database references using a tree structure: `/[file-type]/[first-letter-of-filename]/[full-filename]`
- **Links between elements**: Directional connections defining relationships like "contains" or "is-a-type"
  - All elements can link to any other element with "contains"
  - Only elements linking to labels can use "is-a-type" relationships
- **Views**: Saved configurations for visualizing data (relation graph, spreadsheet, block editor)
- **Labels**: Text tags for categorization, can be connected via relationships
- **Schemas**: Class-like definitions with fields and their types

## UI Structure
- **Left sidebar**: Recently used views
- **Center**: Currently selected view
- **Top**: Search bar
- **Bottom**: Code editor showing and allowing modification of TypeScript code for the active view
  - Should include syntax highlighting
  - Easy access to documentation for data search and filtering methods
  - Designed for users with medium to high programming knowledge

## View Types

### 1. Relation Graph View (using Apache ECharts)
- Shows elements in a graph with connections
- Different colors for relationship types and element types
- User interactions:
  - Click to center an element
  - Right-click to add new elements with relationships
  - Double-click to open elements in their appropriate editors
  - Add links between elements
- Editing data elements opens a pop-up window

### 2. Spreadsheet View
- Configurable columns for different data types
- Rows can be defined explicitly or as contained elements
- Users can resize/format columns and rows
- Direct editing for appropriate elements (checkboxes)
- Pop-up editors for markdown and CSV data

### 3. Block Editor View
- Shows all contained elements of a main element
- Direct editing of all elements within the view
- Filterable by attributes
- Embedded code editor (toggleable)

### 4. Schema View
- Two-column display for fields and types
- UI for schema management
- No associated code

# Technical Details
- The TypeScript code for views is executed directly (no sandboxing required)
- Views have read-only access to the database through GraphQL
- Available functionality includes:
  - Searching for data/labels/schemas
  - Filtering by relationships and attributes
- No authentication required initially, but must support multiple simultaneous requests
- Simple real-time collaboration: elements cannot be edited by multiple users simultaneously
- Performance optimization can be addressed as needed when the application slows down
- No import/export functionality needed initially

## Startup State
- Application starts with a single "Universe" view
- This is a relation view with the "Universe" element at the center

## Deployment
- Packaged as a Docker image for local deployment
- Intended as a prototype but should be stable for use in a secured environment

# Ideas
- look at https://github.com/TriliumNext/Notes
- can git version control be used for the chronological data?
- for storage in git, how to merge different participation?
