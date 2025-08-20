use tokio::sync::mpsc::Receiver;

use crate::structs::{Source, SourceCapabilities, Transaction};

#[derive(Debug)]
pub struct SourceDisk {}

#[async_trait::async_trait]
impl Source for SourceDisk {
    async fn capabilities(&self) -> anyhow::Result<SourceCapabilities> {
        todo!()
    }
    async fn subscribe(
        &mut self,
        store: Receiver<Transaction>,
    ) -> anyhow::Result<Receiver<Transaction>> {
        todo!()
    }
}

impl SourceDisk {
    pub fn new() -> Self {
        todo!()
    }
}
