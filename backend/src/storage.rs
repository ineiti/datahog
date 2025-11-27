use std::sync::Arc;

use bincode::config;
use datahog::structs::{Edge, EdgeID, Node, NodeID};
use rocket::{response::status::BadRequest, tokio::sync::Mutex};
use sled::Db;

pub struct Storage {
    db: Arc<Mutex<Db>>,
    root: Node,
}

impl Storage {
    pub fn new() -> anyhow::Result<Self> {
        let mut db = sled::open("./sledge.db")?;
        let root = Self::get_root(&mut db)?;
        Ok(Self {
            root,
            db: Arc::new(Mutex::new(db)),
        })
    }

    fn get_root(db: &mut Db) -> anyhow::Result<Node> {
        if let Some(id_u8) = db.get(*NodeID::zero())? {
            let id: [u8; 32] = id_u8.as_ref().try_into()?;
            let id: NodeID = id.into();
            if let Some(root_u8) = db.get(*id)? {
                return Ok(bincode::serde::decode_from_slice(&root_u8, config::standard())?.0);
            }
        }
        let root = Node::label("Universe");
        db.insert(NodeID::zero(), root.id.as_ref())?;
        println!("Root is: {root:?}");
        let buf = bincode::serde::encode_to_vec(&root, config::standard())?;
        db.insert(root.id.as_ref(), buf)?;
        Ok(root)
    }

    pub async fn get_node(&self, id: NodeID) -> Result<Node, BadRequest<String>> {
        let db = self.db.lock().await;
        if let Some(val) = db.get(*id).map_err(|e| BadRequest(e.to_string()))? {
            return Ok(bincode::serde::decode_from_slice(&val, config::standard())
                .map_err(|e| BadRequest(format!("{e:?}")))?
                .0);
        }
        Err(BadRequest("Node not found".into()))
    }

    pub async fn get_edge(&self, id: EdgeID) -> Result<Edge, BadRequest<String>> {
        let db = self.db.lock().await;
        if let Some(val) = db.get(*id).map_err(|e| BadRequest(e.to_string()))? {
            return Ok(bincode::serde::decode_from_slice(&val, config::standard())
                .map_err(|e| BadRequest(format!("{e:?}")))?
                .0);
        }
        Err(BadRequest("Edge not found".into()))
    }

    pub async fn update_node(&self, node: Node) -> Result<(), BadRequest<String>> {
        let db = self.db.lock().await;
        let buf = bincode::serde::encode_to_vec(&node, config::standard())
            .map_err(|e| BadRequest(format!("{e:?}")))?;
        db.insert(*node.id, buf)
            .map_err(|e| BadRequest(format!("{e:?}")))?;
        Ok(())
    }

    pub async fn update_edge(&self, edge: Edge) -> Result<(), BadRequest<String>> {
        let db = self.db.lock().await;
        let buf = bincode::serde::encode_to_vec(&edge, config::standard())
            .map_err(|e| BadRequest(format!("{e:?}")))?;
        db.insert(*edge.id, buf)
            .map_err(|e| BadRequest(format!("{e:?}")))?;
        Ok(())
    }

    pub fn init(&self) -> Node {
        self.root.clone()
    }
}
