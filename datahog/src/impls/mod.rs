use either::Either;

use crate::structs::{Edge, HasID, Node, Record, RecordCUD, Timestamp, Transaction, Validity};

pub mod edge;
pub mod node;

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
