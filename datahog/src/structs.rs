//! The basic structs used throughout the datahog library.

use std::collections::HashMap;

use bytes::Bytes;
use either::Either;
use flarch::nodeids::U256;
use flmacro::{AsU256, VersionedSerde};
use num_bigfloat::BigFloat;
use num_bigint::BigInt;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc::Receiver;

/// A [Transaction] is the fundamental storage entity in `DataHog`.
/// All [Transaction]s must be read in order to get the current state
/// of the [Node]s and [Edge]s.
/// TODO: Speed-up by creating snapshots of the [Node]s and [Edge]s
/// at specific timestamps.
#[derive(VersionedSerde, Clone, PartialEq, Eq, Debug)]
pub struct Transaction {
    /// Time of registration.
    pub timestamp: Timestamp,
    /// A set of records to create and/or update zero or more [Node]s and/or [Edge]s.
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
/// Finally, the [Node::history] is a filtered list of all [Transaction]s
/// used to build this [Node] version.
#[derive(VersionedSerde, Clone, PartialEq, Eq, Debug)]
pub struct Node {
    /// The unique identifier of this node
    pub id: NodeID,
    /// What functionality this node has - can never be changed
    pub kind: NodeKind,
    /// The label used to display the node on screen
    pub label: String,
    /// The version of this node's implementation, which is independant
    /// of the Node-version, handled by [VersionedSerde].
    /// This allows to have evolving interpretations of the edges and arguments
    /// of a Node.
    pub op_version: OpVersion,
    /// Data specific to this node
    pub data: DataHash,
    /// Edges to other nodes
    pub edges: HashMap<EdgeID, EdgeKind>,
    /// Arguments used in this node, can be used in Node.data or by the implementation.
    pub arguments: HashMap<String, Argument>,
    /// The full history of this node
    pub history: Vec<RecordEvent>,
}

/// A [DataHash] represents either the hash of an object, if it is too
/// big to be stored in memory, or the bytes of the object itself.
#[derive(Clone, PartialEq, Eq, Debug, Deserialize, Serialize)]
pub enum DataHash {
    /// A sha256 hash of the object.
    Hash(U256),
    /// The bytes of the object.
    Bytes(Bytes),
}

/// An [Edge] is a connection between two or more [Node]s.
///
/// TODO: does an [Edge] need a label / description, potentially pointing
/// to a third [Node]?
#[derive(VersionedSerde, Clone, PartialEq, Eq, Debug)]
pub struct Edge {
    /// The globally unique identifier for this [Edge].
    pub id: EdgeID,
    /// What type of [Edge] this is.
    pub kind: EdgeKind,
    /// Validity of this [Edge].
    pub validity: Validity,
    /// The full history of this [Edge].
    pub history: Vec<RecordEvent>,
}

/// A [RecordEvent] is a filtered [Vec<Record>] where only one [ID] is represented.
#[derive(Clone, PartialEq, Eq, Debug, Deserialize, Serialize)]
pub struct RecordEvent(pub Timestamp, pub Record);

/// These are the main [Node] types defined in the system.
/// Still working out which are the basic types.
/// If there are too many, new types will have to be added too often.
/// If there are too few, it will be difficult to use them in all circumstances.
#[derive(Clone, PartialEq, Eq, Debug, Deserialize, Serialize)]
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
#[derive(Clone, PartialEq, Eq, Debug, Deserialize, Serialize)]
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
#[derive(Clone, PartialEq, Eq, Debug, Deserialize, Serialize)]
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
#[derive(Clone, PartialEq, Eq, Debug, Deserialize, Serialize)]
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

pub type RecordCUDNode = RecordCUD<NodeID, Node, NodeUpdate>;
pub type RecordCUDEdge = RecordCUD<EdgeID, Edge, EdgeAction>;

/// One entry in a transaction, representing actions on a single
/// [Node] or [Edge].
#[derive(Clone, PartialEq, Eq, Debug, Deserialize, Serialize)]
pub enum Record {
    /// A [Node] entry with its [NodeID], the `Create` type, and the `Action` type.
    Node(RecordCUDNode),
    /// An [Edge] entry with its [EdgeID], the `Create` type, and the `Action` type.
    Edge(RecordCUDEdge),
}

/// A common structure for Node- and Edge- ID, creation, and update.
/// An element can be `Create`d and `Update`d at the same time.
#[derive(Clone, PartialEq, Eq, Debug, Deserialize, Serialize)]
pub struct RecordCUD<ID, Create, Update>
where
    Create: HasID<ID>,
{
    /// The ID of the element, must be globally unique, or the `Create` type.
    pub base: Either<ID, Create>,
    /// Updating the element.
    pub updates: Vec<Update>,
}

/// The validity of an [Edge]. If a [Node] has multiple validity
/// periods, then it must have one [Edge] per period.
#[derive(Clone, PartialEq, Eq, Debug, Deserialize, Serialize)]
pub enum Validity {
    From(Timestamp),
    To(Timestamp),
    Period(Timestamp, Timestamp),
}

/// Elements of a [Node] to update.
#[derive(Clone, PartialEq, Eq, Debug, Deserialize, Serialize)]
pub enum NodeUpdate {
    Label(String),
    Data(Bytes),
    SetArgument(String, Argument),
    RemoveArgument(String),
    Migrate(OpVersion, Vec<NodeUpdate>),
    Delete,
}

/// Elements of an [Edge] to update.
#[derive(Clone, PartialEq, Eq, Debug, Deserialize, Serialize)]
pub enum EdgeAction {
    /// The length of the [Vec<NodeID>] must be at least 2, else it's an invalid
    /// action.
    UpdateIDs(Vec<NodeID>),
    /// Updating the [Validity].
    Validity(Validity),
    /// Deleting this [Edge].
    Delete,
}

/// The different kinds of [Edge]s available.
#[derive(Clone, PartialEq, Eq, Debug, Deserialize, Serialize)]
pub enum EdgeKind {
    /// An [EdgeKind::Equality] type of [Edge] connects two or more [Node]s together.
    /// These [Node]s are supposed to be very similar in one sense or another.
    Equality(Vec<NodeID>),
    /// A [EdgeKind::Definition] type of [Edge] points from an _object_ to a _label_.
    /// The _label_ [Node] should be of type [NodeKind::Description].
    ///
    /// TODO: does a label need to have a link to all objects which point to it?
    Definition { object: NodeID, label: NodeID },
    /// A [EdgeKind::Using] edge connects a [Node] as a _client_ to a [Node] as an _object_.
    Using { client: NodeID, object: NodeID },
    /// A [EdgeKind::Contains] edge connects a [Node] as a _container_ to a [Node] as an _object_.
    Contains { container: NodeID, object: NodeID },
}

/// The ID of a [Node] - should be globally unique.
#[derive(AsU256, Deserialize, Serialize, Clone, PartialEq, Eq, Hash)]
pub struct NodeID(U256);

/// The ID of an [Edge] - should be globally unique.
#[derive(AsU256, Deserialize, Serialize, Clone, PartialEq, Eq, Hash)]
pub struct EdgeID(U256);

/// The ID of a [Source] - should be globally unique.
#[derive(AsU256, Deserialize, Serialize, Clone, PartialEq, Eq, Hash)]
pub struct SourceID(U256);

/// What this source can do.
#[derive(Clone, Debug)]
pub struct SourceCapabilities {
    pub id: SourceID,
    pub auto_fetch: bool,
    pub accepts_txs: bool,
    pub can_search: bool,
}

/// A [Source] of [Node]s and [Edge]s.
#[async_trait::async_trait]
pub trait Source: std::fmt::Debug {
    async fn capabilities(&self) -> anyhow::Result<SourceCapabilities>;

    async fn subscribe(
        &mut self,
        store: Receiver<Transaction>,
    ) -> anyhow::Result<Receiver<Transaction>>;
}

pub trait HasID<T>: std::fmt::Debug {
    fn id(&self) -> T;
}

/// Timestamp is in nanoseconds since the UNIX Epoch. This allows
/// for easy conversion to methods using the UNIX Epoch, as well as
/// going back to the beginning of the universe, but not close to the
/// heat death of it.
/// To allow for planck time (5*10**-45 s) resolution until the (premature) heat death of the universe
/// in 10**90 years, this would be 512 bits, which seems a bit excessive.
pub type Timestamp = i128;

/// How to operate on this node, if there are multiple versions of this
/// node kind.
pub type OpVersion = u32;
