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
use tokio::sync::mpsc::{Receiver, Sender};

use crate::{
    storage::dir_trait::{DirectoryEntry, Reader, Writer},
    structs::{Source, SourceCapabilities, SourceID, Transaction},
};

#[derive(Debug)]
pub struct SourceDisk<RW>
where
    RW: Reader + Writer + std::fmt::Debug + Sync + Send,
{
    disk: RW,
    sender: Sender<Transaction>,
    disk_txs: Receiver<Transaction>,
}

#[async_trait::async_trait]
impl<RW: Reader + Writer + std::fmt::Debug + Sync + Send> Source for SourceDisk<RW> {
    async fn capabilities(&self) -> anyhow::Result<SourceCapabilities> {
        Ok(SourceCapabilities {
            id: SourceID::rnd(),
            auto_fetch: true,
            accepts_txs: false,
            can_update: false,
            can_search: false,
        })
    }

    async fn subscribe(
        &mut self,
        _store: Receiver<Transaction>,
    ) -> anyhow::Result<Receiver<Transaction>> {
        for entry in self.disk.read_directory(&[]).await? {
            self.read_dir(entry).await?;
        }
        Ok(rx)
    }
}

impl<RW: Reader + Writer + std::fmt::Debug + Sync + Send> SourceDisk<RW> {
    pub fn new(disk: RW) -> Self {
        let (sender, disk_txs) = tokio::sync::mpsc::channel(100);
        Self {
            disk,
            sender,
            disk_txs,
        }
    }

    async fn read_dir(&mut self, entry: DirectoryEntry) -> anyhow::Result<()> {
        match entry {
            DirectoryEntry::Directory(_) => todo!(),
            DirectoryEntry::File(_) => todo!(),
        }
        Ok(())
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
