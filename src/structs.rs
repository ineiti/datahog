use std::collections::HashMap;

use bytes::Bytes;
use flarch::nodeids::U256;
use flmacro::{AsU256, VersionedSerde};
use num_bigfloat::BigFloat;
use num_bigint::BigInt;
use serde::{Deserialize, Serialize};

/// A [Transaction] is the fundamental storage entity in `DataHog`.
/// It is like a log-entry in a log-filesystem: all [Transaction]s
/// must be read in order to get the current state of the [Node]s and
/// [Edge]s.
/// Speed-ups can be done by creating snapshots of the [Node]s and
/// [Edge]s at specific timestamps.
#[derive(VersionedSerde, Clone, PartialEq, Debug)]
pub struct Transaction {
    /// When these records have been registered.
    pub timestamp: Timestamp,
    /// A set of records to create a [Node] or an [Edge].
    /// When reading a [Transaction], it might lead to a
    /// faulty, e.g., partial, description of a [Node].
    /// 
    /// TODO: what is the correct handling of these faulty [Node]s?
    pub records: Vec<Record>,
}

/// A [Node] is created by one [Transaction], and can be updated by
/// later [Transaction]s.
#[derive(VersionedSerde, Clone, PartialEq, Debug)]
pub struct Node {
    /// What functionality this node has - can never be changed
    kind: NodeKind,
    /// The label used to display the node on screen
    label: String,
    /// The version of this node's implementation, which is independant
    /// of the Node-version, handled by [VersionedSerde].
    /// This allows to have evolving interpretations of the edges and arguments
    /// of a Node.
    op_version: OpVersion,
    /// Data specific to this node
    data: Bytes,
    /// Edges to other nodes
    edges: Vec<EdgeOther>,
    /// Arguments used in this node, can be used in Node.data or by the implementation.
    arguments: HashMap<String, Argument>,
    /// The full history of this node
    history: Vec<RecordEvent>,
}

#[derive(VersionedSerde, Clone, PartialEq, Debug)]
pub struct Edge {
    kind: EdgeKind,
    id: EdgeID,
    history: Vec<RecordEvent>,
}

#[derive(Clone, PartialEq, Debug, Deserialize, Serialize)]
pub struct RecordEvent(Timestamp, Record);

#[derive(Clone, PartialEq, Debug, Deserialize, Serialize)]
pub enum NodeKind {
    /// Nodes to render data - either on screen or disk
    Render(BFRender),
    /// Categorizing nodes - needs to be a NodeKind, so that all [Edge]s are between [Node]s
    Description,
    /// Data holding nodes
    Container(BFContainer),
}

#[derive(Clone, PartialEq, Debug, Deserialize, Serialize)]
pub enum BFRender {
    Markdown,
    Graph,
    Tabular,
    Directory,
}

#[derive(Clone, PartialEq, Debug, Deserialize, Serialize)]
pub enum BFContainer {
    Formatted,
    MimeType(String),
    Schema,
    Concrete,
}

#[derive(Clone, PartialEq, Debug, Deserialize, Serialize)]
pub enum EdgeOther {
    Related(Vec<NodeID>),
    DefLabel(NodeID),
    DefObject(NodeID),
    UseOwner(NodeID),
    UseObject(NodeID),
}

#[derive(Clone, PartialEq, Debug, Deserialize, Serialize)]
pub enum Argument {
    ID(NodeID),
    String(String),
    Int(BigInt),
    Float(BigFloat),
}

#[derive(Clone, PartialEq, Debug, Deserialize, Serialize)]
pub enum Record {
    Add(Shard),
    Migrate(OpVersion, Vec<Shard>),
    Update(Shard),
    DeleteArgument(NodeID, String),
    DeleteNode(NodeID),
    DeleteEdge(EdgeID),
}

#[derive(Clone, PartialEq, Debug, Deserialize, Serialize)]
pub enum EdgeKind {
    Equality(Vec<NodeID>),
    Definition(NodeID, NodeID),
    Using(NodeID, NodeID),
}

#[derive(Clone, PartialEq, Debug, Deserialize, Serialize)]
pub enum Shard {
    Label(String),
    Data(Bytes),
    ActiveFrom(Timestamp),
    ActiveTo(Timestamp),
    Argument(NodeID, String, Argument),
    Node(NodeID, NodeKind, OpVersion),
    Edge(EdgeID, EdgeKind),
}

#[derive(AsU256, Deserialize, Serialize, Clone, PartialEq, Eq, Hash)]
pub struct NodeID(U256);

#[derive(AsU256, Deserialize, Serialize, Clone, PartialEq, Eq, Hash)]
pub struct EdgeID(U256);

/// Timestamp is in nanoseconds since the UNIX Epoch. This allows
/// for easy conversion to methods using the UNIX Epoch, as well as
/// going back to the beginning of the universe.
pub type Timestamp = i128;

pub type OpVersion = u32;
