use std::collections::HashMap;

pub use datahog::{
    structs::{Edge, EdgeID, Node, NodeID, NodeKind},
    views::DataNode,
};
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

    #[wasm_bindgen(getter, js_name = "label")]
    pub fn label_get(&self) -> String {
        self.0.label.clone()
    }

    #[wasm_bindgen(setter, js_name = "label")]
    pub fn label_set(&mut self, label: String) {
        self.0.label = label;
    }

    #[wasm_bindgen(getter)]
    pub fn kind(&self) -> String {
        match &self.0.kind {
            NodeKind::Schema => "Schema",
            NodeKind::Label => "Label",
            NodeKind::MimeType(mt) => return format!("MimeType({mt})"),
        }
        .into()
    }

    #[wasm_bindgen(getter, js_name = "dataNode")]
    pub fn data_node_get(&self) -> DataNode {
        self.0.view_data_node_get()
    }

    #[wasm_bindgen(setter, js_name = "dataNode")]
    pub fn data_node_set(&mut self, dn: &DataNode) {
        self.0.view_data_node_set(dn);
    }

    #[wasm_bindgen]
    pub fn to_string(&self) -> String {
        format!("{:?}", self.0)
    }

    pub fn new_label(label: String) -> NodeWrapper {
        NodeWrapper(Node::label(&label))
    }

    pub fn new_mime(label: String, mime: String) -> NodeWrapper {
        NodeWrapper(Node::mime(mime, label))
    }

    pub fn new_schema(label: String) -> NodeWrapper {
        NodeWrapper(Node::schema(label))
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
        dh.init_root().await?;
        Ok(dh)
    }

    pub async fn init_local() -> Result<Self, String> {
        let storage = window()
            .ok_or(format!("Couldn't get window"))?
            .local_storage()
            .map_err(|e| format!("Couldn't get local_storage: {e:?}"))?
            .ok_or(format!("Local storage was empty"))?;

        let mut dh = Self {
            backend: Backend::Local(storage),
            root: NodeID::zero(),
            nodes: HashMap::new(),
            edges: HashMap::new(),
        };
        if dh.init_root().await.is_err() {
            let root = Node::label("Universe_local");
            dh.update_node(&NodeWrapper(root.clone())).await?;
            dh.put("node", U256::zero(), &root).await?;
            dh.root = root.id.clone();
        }
        Ok(dh)
    }

    async fn init_root(&mut self) -> Result<(), String> {
        let root_base = self.get_node(&NodeIDWrapper(*NodeID::zero())).await?.0;
        self.nodes.clear();
        let root = self.get_node(&NodeIDWrapper(*root_base.id)).await?.0;
        let root_id = root.id.clone();
        self.nodes.insert(root_id.clone(), root);
        self.root = root_id;
        Ok(())
    }

    #[wasm_bindgen(getter)]
    pub fn root_id(&self) -> NodeIDWrapper {
        NodeIDWrapper(*self.root)
    }

    pub async fn get_node(&mut self, id: &NodeIDWrapper) -> Result<NodeWrapper, String> {
        if let Some(node) = self.nodes.get(&(**id).into()) {
            return Ok(NodeWrapper(node.clone()));
        }
        if let Some(node) = self.get::<Node>("node", id.0).await? {
            self.nodes.insert(node.id.clone(), node.clone());
            return Ok(NodeWrapper(node));
        }
        Err("No such node found".into())
    }

    pub async fn get_edge(&mut self, id: &EdgeIDWrapper) -> Result<EdgeWrapper, String> {
        if let Some(edge) = self.edges.get(&(**id).into()) {
            return Ok(EdgeWrapper(edge.clone()));
        }

        if let Some(edge) = self.get::<Edge>("edge", id.0).await? {
            self.edges.insert(edge.id.clone(), edge.clone());
            return Ok(EdgeWrapper(edge));
        }

        Err("No such edge found".into())
    }

    pub async fn update_node(&mut self, node: &NodeWrapper) -> Result<(), String> {
        self.nodes.insert(node.0.id.clone(), node.0.clone());
        self.put("node", *node.0.id.clone(), &node.0).await?;
        Ok(())
    }

    pub async fn update_edge(&mut self, edge: &EdgeWrapper) -> Result<(), String> {
        self.edges.insert(edge.0.id.clone(), edge.0.clone());
        self.put("edge", *edge.0.id.clone(), &edge.0).await?;
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
                Some(s) => Ok(Some(
                    serde_json::from_str(&s)
                        .map_err(|e| format!("Deserialization error: {e:?}"))?,
                )),
                None => Ok(None),
            },
        }
    }

    async fn put<T: Serialize>(&mut self, api: &str, id: U256, body: &T) -> Result<(), String> {
        match &self.backend {
            Backend::URL(url) => {
                let client = reqwest::Client::new();
                client
                    .post(format!("{url}/update_{api}"))
                    .json(body)
                    .send()
                    .await
                    .map_err(|e| format!("HTTP::POST error: {e:?}"))?;
            }
            Backend::Local(storage) => storage
                .set(
                    &format!("{id:?}"),
                    &serde_json::to_string(body)
                        .map_err(|e| format!("Serialization error: {e:?}"))?,
                )
                .map_err(|e| format!("Storage error: {e:?}"))?,
        }
        Ok(())
    }
}

#[cfg(test)]
mod test {
    use std::error::Error;

    use wasm_bindgen_test::wasm_bindgen_test;

    use super::*;

    #[wasm_bindgen_test]
    fn test_serde_node() -> Result<(), Box<dyn Error>> {
        let node = Node::label("test");
        let node_str = serde_json::to_string(&node)?;
        let node_copy = serde_json::from_str(&node_str)?;
        assert_eq!(node, node_copy);
        Ok(())
    }
}
