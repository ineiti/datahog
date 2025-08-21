use std::sync::Arc;

use datahog::{storage::WorldView, structs::Transaction};
use rocket::{
    response::status::BadRequest,
    serde::{Deserialize, Serialize}, tokio::sync::Mutex,
};

pub struct Storage {
    _wv: Arc<Mutex<WorldView>>,
}

impl Storage {
    pub fn new() -> Self {
        Self {
            _wv: Arc::new(Mutex::new(WorldView::new())),
        }
    }

    pub async fn get_updates(
        &self,
        list: UpdateRequest,
    ) -> Result<UpdateReply, BadRequest<String>> {
        let reply = UpdateReply {
            transactions: vec![],
        };
        for tx in list.transactions {
            log::debug!("Got tx: {:?}", tx);
        }
        Ok(reply)
    }

    pub fn reset(&self) {}
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(crate = "rocket::serde")]
pub struct UpdateRequest {
    pub transactions: Vec<Transaction>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(crate = "rocket::serde")]
pub struct UpdateReply {
    pub transactions: Vec<Transaction>,
}
