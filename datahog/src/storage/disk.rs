use std::collections::HashMap;

use async_recursion::async_recursion;
use either::Either;
/// This source reads data from disk and creates a graph.
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
use tokio::sync::mpsc::{Receiver, Sender};

use crate::{
    storage::dir_trait::{DirectoryEntry, Reader, Writer},
    structs::{
        BFContainer, BFRender, DataHash, Edge, EdgeID, EdgeKind, Node, NodeID, NodeKind, Record,
        RecordCUD, Source, SourceCapabilities, SourceID, Transaction, Validity,
    },
};

#[derive(Debug)]
pub struct SourceDisk<RW>
where
    RW: Reader + Writer + std::fmt::Debug + Sync + Send,
{
    disk: RW,
}

#[async_trait::async_trait]
impl<RW: Reader + Writer + std::fmt::Debug + Sync + Send> Source for SourceDisk<RW> {
    async fn capabilities(&self) -> anyhow::Result<SourceCapabilities> {
        Ok(SourceCapabilities {
            id: SourceID::rnd(),
            auto_fetch: true,
            accepts_txs: false,
            can_search: false,
        })
    }

    async fn subscribe(
        &mut self,
        _store: Receiver<Transaction>,
    ) -> anyhow::Result<Receiver<Transaction>> {
        let (sender, disk_txs) = tokio::sync::mpsc::channel(100);
        // Start with root directory (empty path) and a labelled parent node.
        let root = Node::label("root");
        for tx in self.read_dir(&root, &[]).await? {
            sender.send(tx).await?;
        }
        Ok(disk_txs)
    }
}

impl<RW: Reader + Writer + std::fmt::Debug + Sync + Send> SourceDisk<RW> {
    pub fn new(disk: RW) -> Self {
        Self { disk }
    }

    #[async_recursion]
    async fn read_dir(
        &mut self,
        parent: &Node,
        path: &[&str],
    ) -> anyhow::Result<Vec<Transaction>> {
        let mut transactions = Vec::new();

        // Read directory entries
        let entries = self.disk.read_dir(path).await?;
        
        for entry in entries {
            match entry {
                DirectoryEntry::File(name) => {
                    let content = self.disk.read_file(&[name]).await?;
                    
                    // Handle markdown files
                    if name.ends_with(".md") {
                        let mut md_txs = self.process_markdown(parent, name, &content).await?;
                        transactions.extend(md_txs);
                    } else {
                        // Regular file: create a node with content as data
                        let mut file_node = Node::container(BFContainer::MimeType("text/plain".to_string()));
                        file_node.label = name.to_string();
                        file_node.data = DataHash::Bytes(content.into());
                        
                        transactions.push(Transaction::create_node(file_node));
                        
                        // Create edge from parent to file node
                        let edge = Edge::contains(parent.id, file_node.id);
                        transactions.push(Transaction::create_edge(edge));
                    }
                },
                DirectoryEntry::Dir(name) => {
                    // Create node for directory
                    let mut dir_node = Node::container(BFContainer::Formatted);
                    dir_node.label = name.to_string();
                    
                    transactions.push(Transaction::create_node(dir_node));
                    
                    // Create edge from parent to directory node
                    let edge = Edge::contains(parent.id, dir_node.id);
                    transactions.push(Transaction::create_edge(edge));
                    
                    // Recursively read contents of subdirectory
                    let mut subdir_path = path.to_vec();
                    subdir_path.push(name);
                    let subdir_txs = self.read_dir(&dir_node, &subdir_path).await?;
                    transactions.extend(subdir_txs);
                },
            }
        }

        Ok(transactions)
    }

    async fn process_markdown(
        &mut self,
        parent: &Node,
        file_name: &str,
        content: &str,
    ) -> anyhow::Result<Vec<Transaction>> {
        // Placeholder — to be implemented later
        Ok(vec![])
    }

    async fn process_file(
        &mut self,
        file_name: &str,
        content: &str,
    ) -> anyhow::Result<Vec<Transaction>> {
        // Placeholder — to be implemented later
        Ok(vec![])
    }
}

#[cfg(test)]
mod tests {
    use flarch::start_logging_filter;

    use crate::{storage::dir_trait::EmulatedDir, worldview::WorldView};

    use super::*;

    #[tokio::test]
    async fn test_single() -> anyhow::Result<()> {
        start_logging_filter(vec![]);
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
