use std::collections::HashMap;

use crate::structs::{Edge, EdgeID, Node, NodeID, Record, Transaction};

#[derive(Debug, Default)]
pub struct Storage {
    transactions: Vec<Transaction>,
    nodes: HashMap<NodeID, Node>,
    edges: HashMap<EdgeID, Edge>,
}

impl Storage {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add_transactions(&mut self, txs: Vec<Transaction>) {
        for tx in txs {
            let ts = tx.timestamp;
            for r in tx.records {
                match r {
                    Record::Add(shard) => todo!(),
                    Record::Migrate(ov, shards) => todo!(),
                    Record::Update(shard) => todo!(),
                    Record::DeleteArgument(node_id, arg) => todo!(),
                    Record::DeleteNode(node_id) => todo!(),
                    Record::DeleteEdge(edge_id) => todo!(),
                }
            }
        }
    }
}
