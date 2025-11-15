use std::collections::HashMap;

use datahog::structs::{Edge, EdgeID, Node, NodeID};
use flarch::nodeids::U256;
use flmacro::AsU256;
use serde::{de::DeserializeOwned, Serialize};
use wasm_bindgen::prelude::*;

use datahog::structs::Transaction;

#[wasm_bindgen(js_name = NodeID)]
#[derive(AsU256)]
pub struct NodeIDWrapper(U256);

#[wasm_bindgen(js_name = EdgeID)]
#[derive(AsU256)]
pub struct EdgeIDWrapper(U256);

#[wasm_bindgen(js_name = Transaction)]
pub struct TransactionWrapper(Transaction);

#[wasm_bindgen(js_class = Transaction)]
impl TransactionWrapper {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        TransactionWrapper(Transaction {
            timestamp: 0,
            records: vec![],
        })
    }

    #[wasm_bindgen(getter)]
    pub fn timestamp(&self) -> i32 {
        return (self.0.timestamp) as i32;
    }
}

#[wasm_bindgen(js_name = Edge)]
pub struct EdgeWrapper(Edge);

#[wasm_bindgen(js_class = Edge)]
impl EdgeWrapper {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        todo!()
    }

    #[wasm_bindgen(getter)]
    pub fn id(&self) -> EdgeIDWrapper {
        EdgeIDWrapper(self.0.id.clone().into())
    }
}

#[wasm_bindgen(js_name = Node)]
pub struct NodeWrapper(Node);

#[wasm_bindgen(js_class = Node)]
impl NodeWrapper {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        todo!()
    }

    #[wasm_bindgen(getter)]
    pub fn id(&self) -> NodeIDWrapper {
        NodeIDWrapper(self.0.id.clone().into())
    }
}

#[wasm_bindgen]
pub struct Datahog {
    url: String,
    root: NodeID,
    nodes: HashMap<NodeID, Node>,
    edges: HashMap<EdgeID, Edge>,
}

#[wasm_bindgen]
impl Datahog {
    pub async fn new(url: String) -> Result<Self, String> {
        let mut dh = Self {
            url,
            root: NodeID::zero(),
            nodes: HashMap::new(),
            edges: HashMap::new(),
        };
        let root: Node = dh.get("init").await?;
        let root_id = root.id.clone();
        dh.nodes.insert(root_id.clone(), root);
        dh.root = root_id;
        Ok(dh)
    }

    pub fn root_id(&self) -> NodeIDWrapper {
        NodeIDWrapper(*self.root)
    }

    pub async fn get_node(&mut self, id: NodeIDWrapper) -> Result<NodeWrapper, String> {
        if let Some(node) = self.nodes.get(&(*id).into()) {
            return Ok(NodeWrapper(node.clone()));
        }
        if let Some(node) = self.get(&format!("get_node?id={id:?}")).await? {
            return Ok(NodeWrapper(node));
        }
        Err("No such node found".into())
    }

    pub async fn get_edge(&mut self, id: EdgeIDWrapper) -> Result<EdgeWrapper, String> {
        if let Some(edge) = self.edges.get(&(*id).into()) {
            return Ok(EdgeWrapper(edge.clone()));
        }
        if let Some(edge) = self.get(&format!("get_edge?id={id:?}")).await? {
            return Ok(EdgeWrapper(edge));
        }
        Err("No such edge found".into())
    }

    pub async fn update_node(&mut self, node: NodeWrapper) -> Result<(), String> {
        self.post("update_node", node.0).await?;
        Ok(())
    }

    pub async fn update_edge(&mut self, edge: EdgeWrapper) -> Result<(), String> {
        self.post("update_edge", edge.0).await?;
        Ok(())
    }

    async fn get<T: DeserializeOwned>(&mut self, api: &str) -> Result<T, String> {
        reqwest::get(&format!("{}/{api}", self.url))
            .await
            .map_err(|e| format!("{e:?}"))?
            .json::<T>()
            .await
            .map_err(|e| format!("{e:?}"))
    }

    async fn post<T: Serialize>(&mut self, api: &str, body: T) -> Result<(), String> {
        let client = reqwest::Client::new();
        client
            .post(&format!("{}/{api}", self.url))
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("{e:?}"))?;
        Ok(())
    }
}
