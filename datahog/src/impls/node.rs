//! The impls module contains implementations of the various traits and structs
//! used throughout the datahog library.

use std::collections::HashMap;

use crate::structs::{
    DataBlob, DataView, HasID, Node, NodeID, NodeKind, NodeUpdate, Record, RecordEvent,
};

impl Node {
    /// Initializes a node with the basic elements.
    pub fn init(kind: NodeKind, label: String) -> Self {
        Self {
            label,
            kind,
            id: NodeID::rnd(),
            op_version: 0,
            edges: vec![],
            history: vec![],
            data_blob: HashMap::from([(0, DataBlob::Text("".into()))]),
            data_view: DataView {
                index: 0,
                child: None,
                sibling: None,
            },
        }
    }
    /// Create a label node with the indicated label.
    pub fn label(label: &str) -> Self {
        Self::init(NodeKind::Label, label.into())
    }

    /// Create a container node with the indicated container.
    pub fn mime(mime_type: String, label: String) -> Self {
        Self::init(NodeKind::MimeType(mime_type), label)
    }

    /// Create a container node with the indicated container.
    pub fn schema(label: String) -> Self {
        Self::init(NodeKind::Schema, label)
    }

    pub fn update(&mut self, update: NodeUpdate) {
        match update {
            NodeUpdate::Label(l) => self.label = l,
            NodeUpdate::Migrate(ver, node_updates) => {
                self.op_version = ver;
                for update in node_updates {
                    self.update(update);
                }
            }
            NodeUpdate::Delete => {}
            _ => todo!(),
        }
    }

    pub fn add_history(&mut self, re: RecordEvent) {
        if let Some(last) = self.history.last() {
            if last != &re {
                self.history.push(re.clone());
                if let Record::Node(rn) = &re.1 {
                    for update in &rn.updates {
                        self.update(update.clone());
                    }
                }
            }
        }
    }
}

impl HasID<NodeID> for Node {
    fn id(&self) -> NodeID {
        self.id.clone()
    }
}
