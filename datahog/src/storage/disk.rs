/// This source reads data from disk and crates a graph.
/// V0 does the following:
/// - reads md files as a graph
///   - interpreting titles and sub-titles as nodes and edges
/// - reads other files as nodes with delayed data loading
/// - creates edges between the nodes based on the directory structure
/// - writes the graph back to disk
///
/// A lot of extensions are possible:
/// - use git-history to integrate outside changes
/// - read other file formats
use tokio::sync::mpsc::Receiver;

use crate::{
    storage::dir_trait::{Reader, Writer},
    structs::{Source, SourceCapabilities, Transaction},
};

#[derive(Debug)]
pub struct SourceDisk {}

#[async_trait::async_trait]
impl Source for SourceDisk {
    async fn capabilities(&self) -> anyhow::Result<SourceCapabilities> {
        todo!()
    }

    async fn subscribe(
        &mut self,
        _store: Receiver<Transaction>,
    ) -> anyhow::Result<Receiver<Transaction>> {
        todo!()
    }
}

impl SourceDisk {
    pub fn new<T: Reader + Writer>(disk: T) -> Self {
        todo!()
    }
}

#[cfg(test)]
mod tests {
    use tokio::sync::mpsc;

    use crate::storage::dir_trait::EmulatedDir;

    use super::*;

    #[tokio::test]
    async fn test_single() -> anyhow::Result<()> {
        let dir = EmulatedDir::new_from_string(&[(
            "notes.md",
            r#"
        # Notes

        ## First Section

        This is the content of the first section.

        ## Second Section

        This is the content of the second section.
        "#,
        )]);
        let mut source = SourceDisk::new(dir);
        let (_, rx) = mpsc::channel(1);
        let _txs = source.subscribe(rx).await?;

        Ok(())
    }
}
