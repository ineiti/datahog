use std::collections::HashMap;

use crate::structs::{Edge, EdgeID, Node, NodeID, Record, Transaction, ValidID, Validity};

#[derive(Debug, Default)]
pub struct WorldView {
    transactions: Vec<Transaction>,
    nodes: HashMap<NodeID, Node>,
    edges: HashMap<EdgeID, Edge>,
    validities: HashMap<ValidID, Validity>,
}

impl WorldView {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add_transactions(&mut self, txs: Vec<Transaction>) {
        for tx in txs {
            let ts = tx.timestamp;
            for r in tx.records {
                match r {
                    Record::Node(record_cud) => todo!(),
                    Record::Edge(record_cud) => todo!(),
                    Record::Validity(record_cud) => todo!(),
                }
            }
        }
    }
}

pub trait Storage {
    
}