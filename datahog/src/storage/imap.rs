use anyhow::Result;

use crate::structs::{Source, SourceID, Transaction};

#[derive(Debug)]
pub struct SourceIMAP {}

#[async_trait::async_trait]
impl Source for SourceIMAP {
    async fn get_updates(&mut self) -> Result<Vec<Transaction>> {
        todo!()
    }

    /// Adds one or more [Transaction]s to this source.
    async fn add_tx(&mut self, _txs: Vec<Transaction>) -> Result<()> {
        todo!()
    }

    /// Returns the unique ID of this source.
    fn get_id(&self) -> SourceID {
        todo!()
    }
}

impl SourceIMAP {
    pub fn new() -> Self {
        todo!()
    }
}
