use std::collections::HashMap;

use datahog::structs::{BFContainer, BFRender, DataHash, Edge, EdgeID, Node, NodeID, NodeKind};
use flarch::nodeids::U256;
use flmacro::AsU256;
use serde::{de::DeserializeOwned, Serialize};
use wasm_bindgen::prelude::*;

use datahog::structs::Transaction;
use web_sys::{window, Storage};

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
    #[wasm_bindgen(getter)]
    pub fn id(&self) -> NodeIDWrapper {
        NodeIDWrapper(self.0.id.clone().into())
    }

    #[wasm_bindgen(getter)]
    pub fn label(&self) -> String {
        self.0.label.clone()
    }

    #[wasm_bindgen]
    pub fn set_label(&mut self, label: String) {
        self.0.label = label;
    }

    #[wasm_bindgen(getter)]
    pub fn kind(&self) -> String {
        match &self.0.kind {
            NodeKind::Render(bfr) => match bfr {
                BFRender::Markdown => "Render::Markdown",
                BFRender::Graph => "Render::Graph",
                BFRender::Tabular => "Render::Tabular",
            },
            NodeKind::Label => "Label",
            NodeKind::Container(bfc) => match bfc {
                BFContainer::Formatted => "Container::Formatted",
                BFContainer::MimeType(t) => {
                    return format!("Container::MimeType::{t}");
                }
                BFContainer::Schema => "Container::Schema",
                BFContainer::Concrete => "Container::Concrete",
            },
        }
        .into()
    }

    #[wasm_bindgen(getter)]
    pub fn data(&self) -> String {
        match &self.0.data {
            DataHash::Hash(u256) => format!("hash({u256})"),
            DataHash::Bytes(bytes) => str::from_utf8(bytes.iter().as_slice())
                .unwrap_or("Invalid String".into())
                .into(),
        }
    }

    #[wasm_bindgen]
    pub fn set_data(&mut self, data: String) {
        self.0.data = DataHash::Bytes(data.into());
    }

    #[wasm_bindgen]
    pub fn to_string(&self) -> String {
        format!("{:?}", self.0)
    }
}

enum Backend {
    URL(String),
    Local(Storage),
}

#[wasm_bindgen]
pub struct Datahog {
    backend: Backend,
    root: NodeID,
    nodes: HashMap<NodeID, Node>,
    edges: HashMap<EdgeID, Edge>,
}

#[wasm_bindgen]
impl Datahog {
    pub async fn init(url: String) -> Result<Self, String> {
        let mut dh = Self {
            backend: Backend::URL(url),
            root: NodeID::zero(),
            nodes: HashMap::new(),
            edges: HashMap::new(),
        };
        let root: Node = dh
            .get::<Node>("node", *NodeID::zero())
            .await?
            .ok_or(format!("Didn't get root node"))?;
        let root_id = root.id.clone();
        dh.nodes.insert(root_id.clone(), root);
        dh.root = root_id;
        Ok(dh)
    }

    pub fn init_local() -> Result<Self, String> {
        let storage = window()
            .ok_or(format!("Couldn't get window"))?
            .local_storage()
            .map_err(|e| format!("Couldn't get local_storage: {e:?}"))?
            .ok_or(format!("Local storage was empty"))?;

        let root = Node::label("Universe_local");
        let mut dh = Self {
            backend: Backend::Local(storage),
            root: root.id.clone(),
            nodes: HashMap::new(),
            edges: HashMap::new(),
        };
        dh.nodes.insert(root.id.clone(), root);
        Ok(dh)
    }

    #[wasm_bindgen(getter)]
    pub fn root_id(&self) -> NodeIDWrapper {
        NodeIDWrapper(*self.root)
    }

    pub async fn get_node(&mut self, id: NodeIDWrapper) -> Result<NodeWrapper, String> {
        if let Some(node) = self.nodes.get(&(*id).into()) {
            return Ok(NodeWrapper(node.clone()));
        }
        if let Some(node) = self.get::<Node>("node", id.0).await? {
            self.nodes.insert(node.id.clone(), node.clone());
            return Ok(NodeWrapper(node));
        }
        Err("No such node found".into())
    }

    pub async fn get_edge(&mut self, id: EdgeIDWrapper) -> Result<EdgeWrapper, String> {
        if let Some(edge) = self.edges.get(&(*id).into()) {
            return Ok(EdgeWrapper(edge.clone()));
        }

        if let Some(edge) = self.get::<Edge>("edge", id.0).await? {
            self.edges.insert(edge.id.clone(), edge.clone());
            return Ok(EdgeWrapper(edge));
        }

        Err("No such edge found".into())
    }

    pub async fn update_node(&mut self, node: NodeWrapper) -> Result<(), String> {
        self.nodes.insert(node.0.id.clone(), node.0.clone());
        self.put("node", *node.0.id.clone(), node.0).await?;
        Ok(())
    }

    pub async fn update_edge(&mut self, edge: EdgeWrapper) -> Result<(), String> {
        self.edges.insert(edge.0.id.clone(), edge.0.clone());
        self.put("edge", *edge.0.id.clone(), edge.0).await?;
        Ok(())
    }

    async fn get<T: DeserializeOwned>(&mut self, api: &str, id: U256) -> Result<Option<T>, String> {
        match &self.backend {
            Backend::URL(url) => reqwest::get(&format!("{url}/get_{api}?id={id:?}"))
                .await
                .map_err(|e| format!("HTTP::GET error: {e:?}"))?
                .json::<Option<T>>()
                .await
                .map_err(|e| format!("Deserialization error: {e:?}")),
            Backend::Local(storage) => match storage
                .get_item(&format!("{id:?}"))
                .map_err(|e| format!("Storage error: {e:?}"))?
            {
                Some(s) => {
                    serde_json::from_str(&s).map_err(|e| format!("Deserialization error: {e:?}"))?
                }
                None => Ok(None),
            },
        }
    }

    async fn put<T: Serialize>(&mut self, api: &str, id: U256, body: T) -> Result<(), String> {
        match &self.backend {
            Backend::URL(url) => {
                let client = reqwest::Client::new();
                client
                    .post(format!("{url}/update_{api}"))
                    .json(&body)
                    .send()
                    .await
                    .map_err(|e| format!("HTTP::POST error: {e:?}"))?;
            }
            Backend::Local(storage) => storage
                .set(
                    &format!("{id:?}"),
                    &serde_json::to_string(&body)
                        .map_err(|e| format!("Serialization error: {e:?}"))?,
                )
                .map_err(|e| format!("Storage error: {e:?}"))?,
        }
        Ok(())
    }
}
