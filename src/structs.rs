use std::collections::HashMap;

use bytes::Bytes;
use flarch::nodeids::U256;
use flmacro::{AsU256, VersionedSerde};
use num_bigfloat::BigFloat;
use num_bigint::BigInt;
use serde::{Deserialize, Serialize};

/// A [Transaction] is the fundamental storage entity in `DataHog`.
/// All [Transaction]s must be read in order to get the current state
/// of the [Node]s and [Edge]s.
/// TODO: Speed-up by creating snapshots of the [Node]s and [Edge]s
/// at specific timestamps.
#[derive(VersionedSerde, Clone, PartialEq, Debug)]
pub struct Transaction {
    /// Time of registration.
    pub timestamp: Timestamp,
    /// A set of records to create and/or update zero or more [Node]s and/or [Edge]s.
    ///
    /// TODO; When reading a [Transaction], it might lead to a
    /// faulty, e.g., partial, description of a [Node].
    /// What is the correct handling of these faulty [Node]s?
    pub records: Vec<Record>,
}

/// A [Node] is a the data structure which represents one of
///
/// - [NodeKind::Render] to display other nodes and edges
/// - [NodeKind::Description] as a kind of label
/// - [NodeKind::Container] with actual data
///
/// Each [Node] has also a version of its implementation, which can
/// evolve through time.
/// The system should be able to display and handle old versions, as
/// well as having a well-defined upgrade paths from older to newer versions.
///
/// In addition to this, each [Node] can have zero or more [Edge]s to other
/// [Node]s to indicate relationships.
///
/// [Argument]s allow the [Node] to hold changeable data to be used by the
/// [NodeKind], or the [Node::data].
///
/// The [Node::validity] holds a record of the time-span(s) this [Node] is
/// valid.
///
/// Finally, the [Node::history] is a filtered list of all [Transaction]s
/// used to build this [Node] version.
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
    edges: HashMap<EdgeID, Edge>,
    /// Arguments used in this node, can be used in Node.data or by the implementation.
    arguments: HashMap<String, Argument>,
    /// Validity of this [Node]. There can be multiple spans of validity, while a [Node]
    /// is valid or not valid.
    validity: HashMap<ValidID, Validity>,
    /// The full history of this node
    history: Vec<RecordEvent>,
}

/// An [Edge] is a connection between two or more [Node]s.
/// As with [Node]s, each [Edge] can have zero or more [Validity]s.
#[derive(VersionedSerde, Clone, PartialEq, Debug)]
pub struct Edge {
    /// What type of [Edge] this is.
    kind: EdgeKind,
    /// Validity of this [Edge]. There can be multiple spans of validity, while an [Edge]
    /// is valid or not valid.
    validity: HashMap<ValidID, Validity>,
    /// The full history of this [Edge].
    history: Vec<RecordEvent>,
}

/// A [RecordEvent] is a filtered [Vec<Record>] where only one [ID] is represented.
#[derive(Clone, PartialEq, Debug, Deserialize, Serialize)]
pub struct RecordEvent(Timestamp, Record);

/// These are the main [Node] types defined in the system.
/// Still working out which are the basic types.
/// If there are too many, new types will have to be added too often.
/// If there are too few, it will be difficult to use them in all circumstances.
#[derive(Clone, PartialEq, Debug, Deserialize, Serialize)]
pub enum NodeKind {
    /// Nodes to render data - either on screen or disk
    Render(BFRender),
    /// Label node used to categorize other nodes.
    Label,
    /// Data holding nodes
    Container(BFContainer),
}

/// How [Node]s and [Edge]s linked to this node are rendered.
/// This list will evolve over time, and things like a `Html`
/// renderer might come at a later moment.
/// TODO: define which [Node]s are displayed for each of the
/// Renderers.
#[derive(Clone, PartialEq, Debug, Deserialize, Serialize)]
pub enum BFRender {
    /// This renderer interprets the [Node::data] as an md file
    /// and includes also other [Node]s linked to it.
    /// TODO: how other [Node]s are rendered depending on their kind
    /// of links.
    Markdown,
    /// A generic renderer allowing to re-arrange [Node]s and their
    /// [Edge]s.
    Graph,
    /// Show the data of the node in a table, akin to a spreadsheet.
    Tabular,
}

/// What type of data a [Node] holds. This is used by other [Node]s to
/// point to common data.
/// TODO: which data is stored in which place? There are the [Node::data],
/// [Node::arguments], and the [NodeKind::Container].
#[derive(Clone, PartialEq, Debug, Deserialize, Serialize)]
pub enum BFContainer {
    /// ???
    Formatted,
    /// Any type of data potentially represented as a file.
    MimeType(String),
    /// Like a database schema, defines fields which need to be filled
    /// by each [Node] being part of the schema.
    Schema,
    /// ???
    Concrete,
}

/// An argument to a [Node] which is used in its [Node::data] field.
#[derive(Clone, PartialEq, Debug, Deserialize, Serialize)]
pub enum Argument {
    /// Points to another [Node]
    /// TODO: why isn't this an [Edge]?
    ID(NodeID),
    /// Generic string.
    String(String),
    /// Element of `Z`.
    Int(BigInt),
    /// Element of `R`.
    Float(BigFloat),
}

/// One entry in a transaction, representing actions on a single
/// [Node], [Edge], or [Validity].
#[derive(Clone, PartialEq, Debug, Deserialize, Serialize)]
pub enum Record {
    Node(RecordCUD<NodeID, (NodeKind, OpVersion), NodeAction>),
    Edge(RecordCUD<EdgeID, EdgeKind, EdgeAction>),
    Validity(RecordCUD<ValidID, Validity, Validity>),
}

#[derive(Clone, PartialEq, Debug, Deserialize, Serialize)]
pub struct RecordCUD<ID, Create, Action> {
    id: ID,
    create: Option<Create>,
    actions: Vec<Action>,
}

/// TODO: Can this be represented as an [Edge]?
#[derive(Clone, PartialEq, Debug, Deserialize, Serialize)]
pub enum Validity {
    From(Timestamp),
    To(Timestamp),
    Period(Timestamp, Timestamp),
}

#[derive(Clone, PartialEq, Debug, Deserialize, Serialize)]
pub enum NodeAction {
    Label(String),
    Data(Bytes),
    AddValidity(ValidID),
    RemoveValidity(ValidID),
    SetArgument(String, Argument),
    RemoveArgument(String),
    Migrate(OpVersion, Vec<NodeAction>),
    Delete,
}

#[derive(Clone, PartialEq, Debug, Deserialize, Serialize)]
pub enum EdgeAction {
    AddValidity(ValidID),
    RemoveValidity(ValidID),
    Update(EdgeKind),
    Delete,
}

#[derive(Clone, PartialEq, Debug, Deserialize, Serialize)]
pub enum EdgeKind {
    /// This type of [Edge] connects two or more [Node]s together.
    /// These [Node]s are supposed to be very similar in one sense or another.
    Equality(Vec<NodeID>),
    /// A definition type of [Edge] points from an _object_ to a _label_.
    /// The _label_ [Node] should be of type [NodeKind::Description].
    ///
    /// TODO: does a label need to have a link to all objects which point to it?
    Definition { object: NodeID, label: NodeID },
    /// A using edge connects a [Node] as a _client_ to a [Node] as an _object_.
    Using { client: NodeID, object: NodeID },
}

#[derive(AsU256, Deserialize, Serialize, Clone, PartialEq, Eq, Hash)]
pub struct NodeID(U256);

#[derive(AsU256, Deserialize, Serialize, Clone, PartialEq, Eq, Hash)]
pub struct EdgeID(U256);

#[derive(AsU256, Deserialize, Serialize, Clone, PartialEq, Eq, Hash)]
pub struct ValidID(U256);

/// Timestamp is in nanoseconds since the UNIX Epoch. This allows
/// for easy conversion to methods using the UNIX Epoch, as well as
/// going back to the beginning of the universe, but not close to the
/// heat death of it.
pub type Timestamp = i128;

pub type OpVersion = u32;
