use either::Either;

use crate::structs::{
    DataHash, Edge, EdgeAction, EdgeID, HasID, Node, NodeID, NodeUpdate, RecordCUD,
};

impl Node {
    pub fn update(&mut self, update: NodeUpdate) {
        match update {
            NodeUpdate::Label(l) => self.label = l,
            NodeUpdate::Data(b) => self.data = DataHash::Bytes(b),
            NodeUpdate::SetArgument(k, v) => {
                self.arguments.insert(k, v);
            }
            NodeUpdate::RemoveArgument(k) => {
                self.arguments.remove(&k);
            }
            NodeUpdate::Migrate(ver, node_updates) => {
                self.op_version = ver;
                for update in node_updates {
                    self.update(update);
                }
            }
            NodeUpdate::Delete => {}
        }
    }
}

impl HasID<NodeID> for Node {
    fn id(&self) -> NodeID {
        self.id.clone()
    }
}

impl HasID<EdgeID> for Edge {
    fn id(&self) -> EdgeID {
        self.id.clone()
    }
}

impl Edge {
    pub fn update(&mut self, update: EdgeAction) {}
}

impl<ID, Create, Update> RecordCUD<ID, Create, Update>
where
    Create: HasID<ID>,
    ID: Clone,
{
    pub fn get_id(&self) -> ID {
        match &self.base {
            Either::Left(id) => (*id).clone(),
            Either::Right(c) => c.id(),
        }
    }
}
