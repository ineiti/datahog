/// The [WorldView] is responsible for managing the data from multiple [Source]s,
/// ensuring that the data is consistent and up-to-date. It provides a single
/// interface for accessing and manipulating the data, making it easy to work
/// with the data from different sources.
use std::collections::HashMap;

use tokio::sync::mpsc::{Receiver, Sender, channel};

use crate::structs::{
    Edge, EdgeID, Node, NodeID, Record, Source, SourceCapabilities, SourceID, Transaction,
};

#[derive(Debug)]
pub struct WorldView {
    transactions: Vec<Transaction>,
    nodes: HashMap<NodeID, Node>,
    edges: HashMap<EdgeID, Edge>,
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
            transactions: vec![],
            nodes: HashMap::new(),
            edges: HashMap::new(),
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

    pub async fn fetch(&mut self) -> anyhow::Result<(Vec<Transaction>, Vec<NodeID>, Vec<EdgeID>)> {
        let mut txs = vec![];
        for source in &mut self.source_update {
            while let Ok(tx) = source.1.try_recv() {
                txs.push(tx);
            }
        }
        let (mut nodes, mut edges) = (vec![], vec![]);
        for tx in &txs {
            let (mut ns, mut es) = self.do_tx(tx.clone());
            nodes.append(&mut ns);
            edges.append(&mut es);
        }
        Ok((txs, nodes, edges))
    }

    fn do_tx(&mut self, tx: Transaction) -> (Vec<NodeID>, Vec<EdgeID>) {
        let (mut nids, mut eids) = (vec![], vec![]);
        for r in &tx.records {
            match r {
                Record::Node(rc) => nids.push(rc.id.clone()),
                Record::Edge(rc) => eids.push(rc.id.clone()),
            }
        }
        self.transactions.push(tx);
        (nids, eids)
    }

    pub fn add_transactions(&mut self, _source: &SourceID, txs: Vec<Transaction>) {
        for tx in txs {
            self.do_tx(tx);
        }
    }

    pub fn get_node(&self, id: &NodeID) -> Option<Node> {
        self.nodes.get(id).cloned()
    }

    pub fn get_edge(&self, id: &EdgeID) -> Option<Edge> {
        self.edges.get(id).cloned()
    }
}
