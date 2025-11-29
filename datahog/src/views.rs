use serde::{Deserialize, Serialize};

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

use crate::structs::{DataBlob, DataView, Node};

/// A [DataNode] combines [DataView] and [DataBlob] into a wasm-compatible
/// data structure.
#[derive(Clone, PartialEq, Eq, Debug, Deserialize, Serialize)]
#[cfg_attr(target_arch = "wasm32", wasm_bindgen(getter_with_clone, inspectable))]
pub struct DataNode {
    /// The data
    pub data: String,
    /// An optional child node
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen(readonly))]
    pub child: Vec<DataNode>,
    /// An optional sibling (next) node
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen(readonly))]
    pub sibling: Vec<DataNode>,
}

impl Node {
    pub fn view_data_node_get(&self) -> DataNode {
        self.data_node_get(&self.data_view)
    }

    fn data_node_get(&self, dv: &DataView) -> DataNode {
        let mut dn = DataNode {
            data: "".into(),
            child: vec![],
            sibling: vec![],
        };
        if let Some(DataBlob::Text(db)) = self.data_blob.get(&dv.index) {
            dn.data = db.clone();
            if let Some(child) = &dv.child {
                dn.child.push(self.data_node_get(child));
            }
            if let Some(sibling) = &dv.sibling {
                dn.sibling.push(self.data_node_get(sibling));
            }
        }
        dn
    }

    pub fn view_data_node_set(&mut self, dn: &DataNode) {
        self.data_blob.clear();
        self.data_view = *self.data_node_set(dn);
    }

    fn data_node_set(&mut self, dn: &DataNode) -> Box<DataView> {
        let index = self.data_blob.len() as u32;
        self.data_blob
            .insert(index, DataBlob::Text(dn.data.clone()));
        let child = dn.child.first().map(|c| self.data_node_set(c));
        let sibling = dn.sibling.first().map(|c| self.data_node_set(c));
        Box::new(DataView {
            index,
            child,
            sibling,
        })
    }
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
impl DataNode {
    #[wasm_bindgen(constructor)]
    pub fn new(data: String) -> Self {
        Self {
            data,
            child: vec![],
            sibling: vec![],
        }
    }

    pub fn set_child(&mut self, dn: &DataNode) {
        self.child = vec![dn.clone()];
    }

    pub fn set_sibling(&mut self, dn: &DataNode) {
        self.sibling = vec![dn.clone()];
    }
}

#[cfg(test)]
mod test {
    use super::*;

    fn test_datanode(dn: &DataNode) {
        let mut node = Node::mime("markdown".into(), "test".into());
        node.view_data_node_set(dn);
        assert_eq!(dn, &node.view_data_node_get());
    }

    fn dn(data: &str) -> DataNode {
        DataNode {
            data: data.into(),
            child: vec![],
            sibling: vec![],
        }
    }

    #[test]
    fn test_datanode_single() {
        let mut root = dn("root");
        test_datanode(&root);

        let mut child0 = dn("child0");
        root.child.push(child0.clone());
        test_datanode(&root);

        let sibl0 = dn("sibl0");
        root.sibling.push(sibl0);
        test_datanode(&root);

        let child0sibl0 = dn("child0sibl0");
        child0.sibling.push(child0sibl0);
        root.child.clear();
        root.child.push(child0);
        test_datanode(&root);
    }
}
