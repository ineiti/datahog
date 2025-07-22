use std::collections::HashMap;

use crate::structs::{
    Edge, EdgeID, Node, NodeID, Record, Source, SourceCapabilities, SourceID, Timestamp,
    Transaction,
};

pub mod imap;
pub mod disk;

#[derive(Debug, Default)]
pub struct WorldView {
    transactions: Vec<Transaction>,
    nodes: HashMap<NodeID, Node>,
    edges: HashMap<EdgeID, Edge>,
    source_capabilities: HashMap<SourceID, SourceCapabilities>,
    sources: HashMap<SourceID, Box<dyn Source>>,
}

impl WorldView {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn add_source(&mut self, mut source: Box<dyn Source>) -> anyhow::Result<()> {
        let cap = source.capabilities().await?;
        if cap.can_fetch {
            self.add_transactions(cap.id.clone(), source.fetch_new(0).await?);
        }
        self.sources.insert(cap.id.clone(), source);
        self.source_capabilities.insert(cap.id.clone(), cap);
        Ok(())
    }

    pub async fn fetch(&mut self) -> anyhow::Result<()> {
        todo!()
    }

    pub fn add_transactions(&mut self, source: SourceID, txs: Vec<Transaction>) {
        for tx in txs {
            let ts = tx.timestamp;
            for r in tx.records {
                match r {
                    Record::Node(record_cud) => todo!(),
                    Record::Edge(record_cud) => todo!(),
                }
            }
        }
    }
}

