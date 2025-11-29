//! The impls module contains implementations of the various traits and structs
//! used throughout the datahog library.

use crate::structs::{
    Edge, EdgeAction, EdgeID, EdgeKind, HasID, NodeID, Record, RecordEvent, Validity,
};

impl HasID<EdgeID> for Edge {
    fn id(&self) -> EdgeID {
        self.id.clone()
    }
}

impl Edge {
    pub fn contains(container: NodeID, object: NodeID) -> Self {
        Self {
            id: EdgeID::rnd(),
            kind: EdgeKind::Contains { container, object },
            history: vec![],
            validity: Validity::from_now(),
        }
    }

    pub fn add_history(&mut self, re: RecordEvent) {
        if let Some(last) = self.history.last() {
            if last != &re {
                self.history.push(re.clone());
                if let Record::Edge(re) = &re.1 {
                    for update in &re.updates {
                        self.update(update.clone());
                    }
                }
            }
        }
    }

    pub fn update(&mut self, _update: EdgeAction) {
        todo!()
    }
}
