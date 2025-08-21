use flarch::tasks::now;
use tokio::sync::{broadcast, mpsc};

use crate::structs::{Edge, Node, Transaction};

struct EdgeObject {
    edge: Edge,
    _source_updates: broadcast::Receiver<Transaction>,
    _updates: mpsc::Sender<Transaction>,
}

impl EdgeObject {
    pub fn new(
        edge: Edge,
        _source_updates: broadcast::Receiver<Transaction>,
    ) -> (Self, mpsc::Receiver<Transaction>) {
        let (_updates, rx) = mpsc::channel(10);
        (
            Self {
                edge,
                _source_updates,
                _updates,
            },
            rx,
        )
    }

    pub fn update(&mut self, edge: Edge) {
        self._updates.send(Transaction {
            timestamp: now() as i128,
            records: vec![],
        });
    }
}

pub struct NodeObject {
    node: Node,
    _source_updates: broadcast::Receiver<Transaction>,
    _updates: mpsc::Sender<Transaction>,
}

impl NodeObject {
    pub fn new(
        node: Node,
        _source_updates: broadcast::Receiver<Transaction>,
    ) -> (Self, mpsc::Receiver<Transaction>) {
        let (_updates, rx) = mpsc::channel(10);
        (
            Self {
                node,
                _source_updates,
                _updates,
            },
            rx,
        )
    }

    pub fn update(&mut self, node: Node) {
        self._updates.send(Transaction {
            timestamp: now() as i128,
            records: vec![],
        });
    }
}
