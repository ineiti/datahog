use std::collections::HashMap;

/// The disk trait allows for easy testing the dist-storage backend, and then
/// using the actual filesystem for read/write operations.
use async_trait::async_trait;

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub enum DirectoryEntry {
    Directory(String),
    File(String),
}

#[async_trait]
pub trait Reader {
    async fn read_directory(&self, path: &[&str]) -> anyhow::Result<Vec<DirectoryEntry>>;
    async fn read_file(&self, path: &[&str]) -> anyhow::Result<String>;
}

#[async_trait]
pub trait Writer {
    async fn clean(&mut self) -> anyhow::Result<()>;
    async fn create_directory(&mut self, path: &[&str]) -> anyhow::Result<()>;
    async fn write_file(&mut self, path: &[&str], content: &str) -> anyhow::Result<()>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EmulatedDir {
    pub files: HashMap<String, String>,
    pub dirs: HashMap<String, EmulatedDir>,
}

impl EmulatedDir {
    pub fn new() -> Self {
        EmulatedDir {
            files: HashMap::new(),
            dirs: HashMap::new(),
        }
    }

    pub fn new_from_string(content: &[(&str, &str)]) -> Self {
        let mut ed = EmulatedDir::new();

        for (path, content) in content {
            let (dirs, file) = Self::path_to_dir_file(path);
            ed.store_file(dirs, file, content);
        }

        ed
    }

    fn store_file(&mut self, dirs: Vec<String>, file: String, content: &str) {
        if dirs.is_empty() {
            self.files.insert(file, content.to_string());
        } else {
            let dir = dirs.first().unwrap();
            self.dirs
                .entry(dir.clone())
                .or_insert_with(EmulatedDir::new)
                .store_file(dirs[1..].to_vec(), file, content);
        }
    }

    fn path_to_dir_file(path: &str) -> (Vec<String>, String) {
        let mut parts = path
            .split('/')
            .map(|s| s.to_string())
            .collect::<Vec<String>>();
        let file = parts.pop().unwrap();
        (parts, file)
    }
}

#[async_trait]
impl Reader for EmulatedDir {
    async fn read_directory(&self, path: &[&str]) -> anyhow::Result<Vec<DirectoryEntry>> {
        if path.is_empty() {
            let mut entries = Vec::new();

            for name in self.dirs.keys() {
                entries.push(DirectoryEntry::Directory(name.clone()));
            }

            for name in self.files.keys() {
                entries.push(DirectoryEntry::File(name.clone()));
            }

            entries.sort();
            Ok(entries)
        } else {
            match self.dirs.get(path[0]) {
                Some(dir) => dir.read_directory(&path[1..]).await,
                None => anyhow::bail!("Directory '{}' not found", path[0]),
            }
        }
    }

    async fn read_file(&self, path: &[&str]) -> anyhow::Result<String> {
        if path.len() > 1 {
            match self.dirs.get(path[0]) {
                Some(dir) => dir.read_file(&path[1..]).await,
                None => anyhow::bail!("Directory '{}' not found", path[0]),
            }
        } else {
            match self.files.get(path[0]) {
                Some(content) => Ok(content.clone()),
                None => anyhow::bail!("File '{}' not found", path[0]),
            }
        }
    }
}

#[async_trait]
impl Writer for EmulatedDir {
    async fn clean(&mut self) -> anyhow::Result<()> {
        self.dirs.clear();
        self.files.clear();
        Ok(())
    }

    async fn create_directory(&mut self, path: &[&str]) -> anyhow::Result<()> {
        match path.len() {
            0 => anyhow::bail!("Invalid path"),
            1 => {
                let dir = path[0];
                match self.dirs.get(dir) {
                    Some(dir) => anyhow::bail!("Directory '{:?}' already exists", dir),
                    None => {
                        self.dirs.insert(dir.to_string(), EmulatedDir::new());
                        Ok(())
                    }
                }
            }
            _ => {
                let dir = path[0];
                self.dirs
                    .entry(dir.to_string())
                    .or_insert_with(EmulatedDir::new)
                    .create_directory(&path[1..])
                    .await
            }
        }
    }

    async fn write_file(&mut self, path: &[&str], content: &str) -> anyhow::Result<()> {
        match path.len() {
            0 => anyhow::bail!("Invalid path"),
            1 => {
                let file = path[0];
                match self.files.get(file) {
                    Some(file) => anyhow::bail!("File '{:?}' already exists", file),
                    None => {
                        self.files.insert(file.to_string(), content.to_string());
                        Ok(())
                    }
                }
            }
            _ => {
                let dir = path[0];
                self.dirs
                    .entry(dir.to_string())
                    .or_insert_with(EmulatedDir::new)
                    .write_file(&path[1..], content)
                    .await
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_dir() -> EmulatedDir {
        EmulatedDir::new_from_string(&vec![
            ("file1", "content1"),
            ("dir1/file2", "content2"),
            ("dir1/dir2/file3", "content3"),
        ])
    }

    #[tokio::test]
    async fn test_new_from_string() {
        let ed = test_dir();

        assert_eq!(ed.files.len(), 1);
        assert_eq!(ed.dirs.len(), 1);
        assert_eq!(
            ed.read_directory(&[]).await.unwrap(),
            vec![
                DirectoryEntry::Directory("dir1".to_string()),
                DirectoryEntry::File("file1".to_string())
            ]
        );
        assert_eq!(
            ed.read_directory(&["dir1"]).await.unwrap(),
            vec![
                DirectoryEntry::Directory("dir2".to_string()),
                DirectoryEntry::File("file2".to_string())
            ]
        );
        assert_eq!(&ed.read_file(&["file1"]).await.unwrap(), "content1");
        assert_eq!(&ed.read_file(&["dir1", "file2"]).await.unwrap(), "content2");
        assert_eq!(
            &ed.read_file(&["dir1", "dir2", "file3"]).await.unwrap(),
            "content3"
        );
    }

    #[tokio::test]
    async fn test_clean() {
        let mut ed = test_dir();
        ed.clean().await.unwrap();
        assert_eq!(ed.files.len(), 0);
        assert_eq!(ed.dirs.len(), 0);
    }

    #[tokio::test]
    async fn test_create_directory() {
        let mut ed = test_dir();
        ed.create_directory(&["new_dir"]).await.unwrap();
        assert_eq!(ed.files.len(), 1);
        assert_eq!(ed.dirs.len(), 2);
        assert_eq!(
            ed.read_directory(&[]).await.unwrap(),
            vec![
                DirectoryEntry::Directory("dir1".to_string()),
                DirectoryEntry::Directory("new_dir".to_string()),
                DirectoryEntry::File("file1".to_string()),
            ]
        );
    }

    #[tokio::test]
    async fn test_write_file() {
        let mut ed = test_dir();
        ed.write_file(&["new_file"], "new_content").await.unwrap();
        ed.write_file(&["dir1", "new_file2"], "new_content")
            .await
            .unwrap();
        assert_eq!(ed.files.len(), 2);
        assert_eq!(ed.dirs.len(), 1);
        assert_eq!(
            ed.read_directory(&[]).await.unwrap(),
            vec![
                DirectoryEntry::Directory("dir1".to_string()),
                DirectoryEntry::File("file1".to_string()),
                DirectoryEntry::File("new_file".to_string())
            ]
        );
        assert_eq!(
            ed.read_directory(&["dir1"]).await.unwrap(),
            vec![
                DirectoryEntry::Directory("dir2".to_string()),
                DirectoryEntry::File("file2".to_string()),
                DirectoryEntry::File("new_file2".to_string())
            ]
        );
        assert_eq!(&ed.read_file(&["new_file"]).await.unwrap(), "new_content");
    }
}
