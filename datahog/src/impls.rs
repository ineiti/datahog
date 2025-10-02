//! The impls module contains implementations of the various traits and structs
//! used throughout the datahog library.

use std::collections::HashMap;

use bytes::Bytes;
use either::Either;

use crate::structs::{
    BFContainer, DataHash, Edge, EdgeAction, EdgeID, EdgeKind, HasID, Node, NodeID, NodeKind,
    NodeUpdate, Record, RecordCUD, RecordEvent, Timestamp, Transaction, Validity,
};

impl Node {
    pub fn label(label: &str) -> Self {
        Self {
            id: NodeID::rnd(),
            label: label.to_string(),
            data: DataHash::Bytes(Bytes::new()),
            arguments: Default::default(),
            op_version: 0,
            kind: NodeKind::Label,
            edges: HashMap::new(),
            history: vec![],
        }
    }

    pub fn container(container: BFContainer) -> Self {
        Self {
            id: NodeID::rnd(),
            label: "container".to_string(),
            data: DataHash::Bytes(Bytes::new()),
            arguments: Default::default(),
            op_version: 0,
            kind: NodeKind::Container(container),
            edges: HashMap::new(),
            history: vec![],
        }
    }

    pub fn update(&mut self, update: NodeUpdate) {
        match update {
            NodeUpdate::Label(l) => self.label = l,
            NodeUpdate::Data(b) => self.data = DataHash::Bytes(b),
            NodeUpdate::SetArgument(k, v) => {
                self.arguments.insert(k, v);
            }
            NodeUpdate::RemoveArgument(k) => {
                self.arguments.remove(&k);
            }
            NodeUpdate::Migrate(ver, node_updates) => {
                self.op_version = ver;
                for update in node_updates {
                    self.update(update);
                }
            }
            NodeUpdate::Delete => {}
        }
    }

    pub fn add_history(&mut self, re: RecordEvent) {
        if let Some(last) = self.history.last() {
            if last != &re {
                self.history.push(re.clone());
                if let Record::Node(rn) = &re.1 {
                    for update in &rn.updates {
                        self.update(update.clone());
                    }
                }
            }
        }
    }
}

impl HasID<NodeID> for Node {
    fn id(&self) -> NodeID {
        self.id.clone()
    }
}

impl HasID<EdgeID> for Edge {
    fn id(&self) -> EdgeID {
        self.id.clone()
    }
}

impl Edge {
    pub fn contains(container: NodeID, object: NodeID) -> Self {
        Self {
            id: EdgeID::rnd(),
            kind: EdgeKind::Contains { container, object },
            history: vec![],
            validity: Validity::from_now(),
        }
    }

    pub fn add_history(&mut self, re: RecordEvent) {
        if let Some(last) = self.history.last() {
            if last != &re {
                self.history.push(re.clone());
                if let Record::Edge(re) = &re.1 {
                    for update in &re.updates {
                        self.update(update.clone());
                    }
                }
            }
        }
    }

    pub fn update(&mut self, _update: EdgeAction) {
        todo!()
    }
}

impl Validity {
    pub fn from_now() -> Self {
        Validity::From(timestamp_now())
    }
}

impl Transaction {
    pub fn create_node(node: Node) -> Self {
        Self {
            timestamp: timestamp_now(),
            records: vec![Record::Node(RecordCUD {
                base: Either::Right(node),
                updates: vec![],
            })],
        }
    }

    pub fn create_edge(edge: Edge) -> Self {
        Self {
            timestamp: timestamp_now(),
            records: vec![Record::Edge(RecordCUD {
                base: Either::Right(edge),
                updates: vec![],
            })],
        }
    }
}

pub fn timestamp_now() -> Timestamp {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("Time went backwards")
        .as_nanos() as Timestamp
}

impl<ID, Create, Update> RecordCUD<ID, Create, Update>
where
    Create: HasID<ID>,
    ID: Clone,
{
    pub fn get_id(&self) -> ID {
        match &self.base {
            Either::Left(id) => (*id).clone(),
            Either::Right(c) => c.id(),
        }
    }
}
