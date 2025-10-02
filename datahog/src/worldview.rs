//! The [WorldView] is responsible for managing the data from multiple [Source]s,
//! ensuring that the data is consistent and up-to-date. It provides a single
//! interface for accessing and manipulating the data, making it easy to work
//! with the data from different sources.

use std::collections::HashMap;

use tokio::sync::mpsc::{Receiver, Sender, channel};

use crate::structs::{
    Edge, EdgeID, Node, NodeID, Record, RecordEvent, Source, SourceCapabilities, SourceID,
    Transaction,
};

#[derive(Debug)]
pub struct WorldView {
    transactions: Vec<Transaction>,
    nodes: HashMap<NodeID, Node>,
    edges: HashMap<EdgeID, Edge>,
    source_capabilities: HashMap<SourceID, SourceCapabilities>,
    source_store: HashMap<SourceID, Sender<Transaction>>,
    source_update: HashMap<SourceID, Receiver<Transaction>>,
    source_root: HashMap<SourceID, NodeID>,
    sources: HashMap<SourceID, Box<dyn Source>>,
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
            source_root: HashMap::new(),
            sources: HashMap::new(),
            // source_tx: tx,
        };

        wv
    }

    pub async fn add_source(&mut self, mut source: Box<dyn Source>) -> anyhow::Result<NodeID> {
        let cap = source.capabilities().await?;
        let cap_id = cap.id.clone();
        let (tx, rx) = channel(10);
        let update = source.subscribe(rx).await?;
        self.source_store.insert(cap_id.clone(), tx);
        self.source_update.insert(cap_id.clone(), update);
        self.sources.insert(cap.id.clone(), source);
        self.source_capabilities.insert(cap.id.clone(), cap);
        let (txs, nodes, _) = self.fetch(&cap_id).await?;
        if let Some(root) = nodes.first() {
            self.source_root.insert(cap_id.clone(), root.clone());
            self.transactions.extend(txs);
            Ok(root.clone())
        } else {
            anyhow::bail!("No nodes found");
        }
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

    async fn fetch(
        &mut self,
        id: &SourceID,
    ) -> anyhow::Result<(Vec<Transaction>, Vec<NodeID>, Vec<EdgeID>)> {
        if let Some(source) = self.source_update.get_mut(id) {
            let mut txs = vec![];
            while let Ok(tx) = source.try_recv() {
                log::trace!("Got transaction {tx:?}");
                txs.push(tx);
            }
            let (mut nodes, mut edges) = (vec![], vec![]);
            for tx in &txs {
                let (mut ns, mut es) = self.do_tx(tx.clone());
                nodes.append(&mut ns);
                edges.append(&mut es);
            }
            Ok((txs, nodes, edges))
        } else {
            anyhow::bail!("This source doesn't exist");
        }
    }

    fn do_tx(&mut self, tx: Transaction) -> (Vec<NodeID>, Vec<EdgeID>) {
        let (mut nids, mut eids) = (vec![], vec![]);
        self.transactions.push(tx.clone());
        for r in tx.records {
            let rec_event = RecordEvent(tx.timestamp, r.clone());
            match r {
                Record::Node(rc) => {
                    nids.push(rc.get_id());
                    match rc.base {
                        either::Either::Left(id) => {
                            if let Some(node) = self.nodes.get_mut(&id) {
                                node.add_history(rec_event.clone());
                            } else {
                                log::error!("Node {id} not found for update");
                            }
                        }
                        either::Either::Right(mut node) => {
                            node.add_history(rec_event);
                            self.nodes.insert(node.id.clone(), node);
                        }
                    }
                }
                Record::Edge(rc) => {
                    eids.push(rc.get_id());
                    match rc.base {
                        either::Either::Left(id) => {
                            if let Some(mut edge) = self.edges.get(&id).cloned() {
                                self.remove_edge_from_nodes(&rec_event, &edge);
                                edge.add_history(rec_event.clone());
                                self.apply_edge_to_nodes(&rec_event, &edge);
                                self.edges.insert(edge.id.clone(), edge);
                            } else {
                                log::error!("Edge {id} not found for update");
                            }
                        }
                        either::Either::Right(mut edge) => {
                            edge.add_history(rec_event.clone());
                            self.apply_edge_to_nodes(&rec_event, &edge);
                            self.edges.insert(edge.id.clone(), edge);
                        }
                    }
                }
            }
        }
        (nids, eids)
    }

    fn remove_edge_from_nodes(&mut self, re: &RecordEvent, edge: &Edge) {
        for node in match &edge.kind {
            crate::structs::EdgeKind::Equality(_node_ids) => {
                todo!()
            }
            crate::structs::EdgeKind::Definition { object, label } => vec![object, label],
            crate::structs::EdgeKind::Using { client, object } => vec![client, object],
            crate::structs::EdgeKind::Contains { container, object } => {
                vec![container, object]
            }
        } {
            if let Some(node) = self.nodes.get_mut(node) {
                node.edges.remove(&edge.id);
                node.history.push(re.clone());
            }
        }
    }

    fn apply_edge_to_nodes(&mut self, re: &RecordEvent, edge: &Edge) {
        for node in match &edge.kind {
            crate::structs::EdgeKind::Equality(_node_ids) => {
                todo!()
            }
            crate::structs::EdgeKind::Definition { object, label } => vec![object, label],
            crate::structs::EdgeKind::Using { client, object } => vec![client, object],
            crate::structs::EdgeKind::Contains { container, object } => {
                vec![container, object]
            }
        } {
            if let Some(node) = self.nodes.get_mut(node) {
                node.edges.insert(edge.id.clone(), edge.kind.clone());
                if let Some(history) = node.history.last_mut() {
                    if history != re {
                        node.history.push(re.clone());
                    }
                }
            }
        }
    }
}
