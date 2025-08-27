use std::collections::HashMap;

use tokio::sync::mpsc::{Receiver, Sender, channel};

use crate::structs::{
    Edge, EdgeID, Node, NodeID, Record, Source, SourceCapabilities, SourceID,
    Transaction,
};

#[derive(Debug)]
pub struct WorldView {
    _transactions: Vec<Transaction>,
    _nodes: HashMap<NodeID, Node>,
    _edges: HashMap<EdgeID, Edge>,
    source_capabilities: HashMap<SourceID, SourceCapabilities>,
    source_store: HashMap<SourceID, Sender<Transaction>>,
    source_update: HashMap<SourceID, Receiver<Transaction>>,
    // sources: HashMap<SourceID, Box<dyn Source>>,
    // source_tx: Sender<Box<dyn Source>>,
}

impl WorldView {
    pub fn new() -> Self {
        // let (tx, rx) = channel(10);
        let wv = Self {
            _transactions: vec![],
            _nodes: HashMap::new(),
            _edges: HashMap::new(),
            source_capabilities: HashMap::new(),
            source_store: HashMap::new(),
            source_update: HashMap::new(),
            // sources: HashMap::new(),
            // source_tx: tx,
        };

        wv
    }

    pub async fn add_source(&mut self, mut source: Box<dyn Source>) -> anyhow::Result<()> {
        let cap = source.capabilities().await?;
        let (tx, rx) = channel(10);
        let update = source.subscribe(rx).await?;
        self.source_store.insert(cap.id.clone(), tx);
        self.source_update.insert(cap.id.clone(), update);
        // self.sources.insert(cap.id.clone(), source);
        self.source_capabilities.insert(cap.id.clone(), cap);
        Ok(())
    }

    pub async fn fetch(&mut self) -> anyhow::Result<()> {
        todo!()
    }

    pub fn add_transactions(&mut self, _source: SourceID, txs: Vec<Transaction>) {
        for tx in txs {
            // let ts = tx.timestamp;
            for r in tx.records {
                match r {
                    Record::Node(_record_cud) => todo!(),
                    Record::Edge(_record_cud) => todo!(),
                }
            }
        }
    }
}
