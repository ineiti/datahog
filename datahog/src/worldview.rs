//! The [WorldView] is responsible for managing the data from multiple [Source]s,
//! ensuring that the data is consistent and up-to-date. It provides a single
//! interface for accessing and manipulating the data, making it easy to work
//! with the data from different sources.

use anyhow::Result;
use std::collections::HashMap;

use crate::structs::{
    Edge, EdgeID, Node, NodeID, Record, RecordEvent, Source, SourceID, Transaction,
};

#[derive(Debug)]
pub struct WorldView {
    transactions: Vec<Transaction>,
    nodes: HashMap<NodeID, Node>,
    edges: HashMap<EdgeID, Edge>,
    source_root: HashMap<SourceID, NodeID>,
    sources: HashMap<SourceID, Box<dyn Source + Send>>,
}

impl WorldView {
    pub fn new() -> Self {
        let wv = Self {
            transactions: vec![],
            nodes: HashMap::new(),
            edges: HashMap::new(),
            source_root: HashMap::new(),
            sources: HashMap::new(),
        };

        wv
    }

    pub async fn add_source(
        &mut self,
        mut source: Box<dyn Source + Send>,
    ) -> anyhow::Result<NodeID> {
        let sid = source.get_id();
        let txs = source.get_updates().await?;
        let (_, nodes, _) = self.process_updates(txs).await?;
        self.sources.insert(sid.clone(), source);
        if let Some(root) = nodes.first() {
            self.source_root.insert(sid, root.clone());
            Ok(root.clone())
        } else {
            anyhow::bail!("No nodes found in this source");
        }
    }

    pub async fn add_transactions(&mut self, sid: &SourceID, txs: Vec<Transaction>) -> Result<()> {
        if let Some(source) = self.sources.get_mut(sid) {
            source.add_tx(txs.clone()).await?;
        }
        for tx in txs {
            self.do_tx(tx);
        }
        Ok(())
    }

    pub fn get_node(&self, id: &NodeID) -> Option<Node> {
        self.nodes.get(id).cloned()
    }

    pub fn get_edge(&self, id: &EdgeID) -> Option<Edge> {
        self.edges.get(id).cloned()
    }

    pub async fn fetch(&mut self) -> Result<(Vec<Transaction>, Vec<NodeID>, Vec<EdgeID>)> {
        let mut txs = vec![];
        for source in self.sources.values_mut() {
            txs.extend(source.get_updates().await?);
        }
        let (txs, nodes, edges) = self.process_updates(txs).await?;
        Ok((txs, nodes, edges))
    }

    pub fn root_nodes(&self) -> Vec<NodeID> {
        self.source_root.values().cloned().collect::<Vec<_>>()
    }

    async fn process_updates(
        &mut self,
        txs: Vec<Transaction>,
    ) -> anyhow::Result<(Vec<Transaction>, Vec<NodeID>, Vec<EdgeID>)> {
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
