//! This source reads data from disk and creates a graph.
//! V0 does the following:
//! - reads md files as a graph
//!   - interpreting titles and sub-titles as nodes and edges
//! - reads other files as nodes with delayed data loading
//! - creates edges between the nodes based on the directory structure
//! - writes the graph back to disk
//!
//! A lot of extensions are possible:
//! - use git-history to integrate outside changes
//! - read other file formats

use anyhow::Result;
use async_recursion::async_recursion;
use bytes::Bytes;

use crate::{
    storage::dir_trait::{DirectoryEntry, Reader, Writer},
    structs::{BFContainer, DataHash, Edge, Node, NodeID, Source, SourceID, Transaction},
};

#[derive(Debug)]
pub struct SourceDisk<RW>
where
    RW: Reader + Writer + std::fmt::Debug + Sync + Send,
{
    disk: RW,
    read: bool,
}

#[async_trait::async_trait]
impl<RW: Reader + Writer + std::fmt::Debug + Sync + Send> Source for SourceDisk<RW> {
    async fn get_updates(&mut self) -> anyhow::Result<Vec<Transaction>> {
        if !self.read {
            self.read = true;
            // Start with root directory (empty path) and a labelled parent node.
            let root = Node::label("root");
            let txs = self.read_dir(&root.id, vec![]).await?;
            Ok([vec![Transaction::create_node(root)], txs].concat())
        } else {
            Ok(vec![])
        }
    }

    async fn add_tx(&mut self, _txs: Vec<Transaction>) -> Result<()> {
        todo!()
    }

    /// Returns the unique ID of this source.
    fn get_id(&self) -> SourceID {
        todo!()
    }
}

impl<RW: Reader + Writer + std::fmt::Debug + Sync + Send> SourceDisk<RW> {
    pub fn new(disk: RW) -> Self {
        Self { disk, read: false }
    }

    #[async_recursion]
    async fn read_dir(
        &mut self,
        parent: &NodeID,
        path: Vec<&str>,
    ) -> anyhow::Result<Vec<Transaction>> {
        let mut transactions = Vec::new();

        // Read directory entries
        let entries = self.disk.read_directory(&path).await?;

        for entry in entries {
            let mut entry_path = path.clone();
            match entry {
                DirectoryEntry::File(name) => {
                    // Read file and process it
                    log::debug!("Processing file: {name}");
                    entry_path.push(&name);
                    let content = self.disk.read_file(&entry_path).await?;

                    transactions.extend(if name.ends_with(".md") {
                        self.process_markdown(parent, name, content).await?
                    } else {
                        self.process_file(parent, name, content).await?
                    });
                }
                DirectoryEntry::Directory(name) => {
                    // Create node for directory and link to parent
                    log::debug!("Processing directory: {name}");
                    let dir_node = Node::label(&name);
                    let edge = Edge::contains(parent.clone(), dir_node.id.clone());

                    entry_path.push(&name);
                    transactions.extend(self.read_dir(&dir_node.id, entry_path).await?);

                    transactions.extend([
                        Transaction::create_node(dir_node),
                        Transaction::create_edge(edge),
                    ]);
                }
            }
        }

        Ok(transactions)
    }

    async fn process_markdown(
        &mut self,
        parent: &NodeID,
        file_name: String,
        content: String,
    ) -> anyhow::Result<Vec<Transaction>> {
        // Placeholder — to be implemented later
        self.process_file(parent, file_name, content).await
    }

    async fn process_file(
        &mut self,
        parent: &NodeID,
        file_name: String,
        content: String,
    ) -> anyhow::Result<Vec<Transaction>> {
        let mut file_node = Node::container(BFContainer::MimeType("text/plain".to_string()));
        file_node.label = file_name.to_string();
        file_node.data = DataHash::Bytes(Bytes::from(content));

        let edge = Edge::contains(parent.clone(), file_node.id.clone());
        Ok(vec![
            Transaction::create_node(file_node),
            Transaction::create_edge(edge),
        ])
    }
}

#[cfg(test)]
mod tests {
    use flarch::start_logging_filter_level;

    use crate::{storage::dir_trait::EmulatedDir, worldview::WorldView};

    use super::*;

    #[tokio::test]
    async fn test_single() -> anyhow::Result<()> {
        start_logging_filter_level(vec![], log::LevelFilter::Trace);
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
        let mut ww = WorldView::new();
        let root_id = ww.add_source(Box::new(SourceDisk::new(dir))).await?;
        let root = ww.get_node(&root_id);
        log::info!("Root node: {:?}", root);

        Ok(())
    }
}
