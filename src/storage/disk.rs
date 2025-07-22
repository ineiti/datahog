use crate::structs::{Edge, Node, Source, SourceCapabilities, Timestamp, Transaction};

#[derive(Debug)]
pub struct SourceDisk {}

#[async_trait::async_trait]
impl Source for SourceDisk {
    async fn capabilities(&self) -> anyhow::Result<SourceCapabilities> {
        todo!()
    }

    async fn fetch_new(&mut self, since: Timestamp) -> anyhow::Result<Vec<Transaction>> {
        todo!()
    }

    async fn create(&mut self, nodes: Vec<Node>, edges: Vec<Edge>) -> anyhow::Result<()> {
        todo!()
    }

    async fn update(&mut self, nodes: Vec<Node>, edges: Vec<Edge>) -> anyhow::Result<()> {
        todo!()
    }

    async fn search(&mut self, term: String) -> anyhow::Result<()> {
        todo!()
    }
}

impl SourceDisk {
    pub fn new() -> Self {
        todo!()
    }
}
