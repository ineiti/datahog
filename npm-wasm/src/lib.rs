use anyhow::Result;
use datahog::{
    structs::{
        self, BFRender, Edge, EdgeKind, Node, NodeKind, Record, RecordCUD, Source,
        SourceCapabilities, SourceID,
    },
    worldview::WorldView,
};
use flarch::{
    broker::{Broker, SubsystemHandler},
    nodeids::U256,
    platform_async_trait,
    tasks::{now, spawn_local, wait_ms},
};
use js_sys::Function;
use std::collections::HashMap;
use tokio::sync::mpsc;
use wasm_bindgen::prelude::*;
use wasm_bindgen_test::{console_error, console_log};

use datahog::structs::Transaction;

#[wasm_bindgen]
pub struct NodeID(U256);

#[wasm_bindgen]
pub struct EdgeID(U256);

#[wasm_bindgen(js_name = Transaction)]
pub struct TransactionWrapper(Transaction);

#[wasm_bindgen(js_class = Transaction)]
impl TransactionWrapper {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        TransactionWrapper(Transaction {
            timestamp: 0,
            records: vec![],
        })
    }

    #[wasm_bindgen(getter)]
    pub fn timestamp(&self) -> i32 {
        return (self.0.timestamp) as i32;
    }
}

#[wasm_bindgen(js_name = Edge)]
pub struct EdgeWrapper(Edge);

#[wasm_bindgen(js_class = Edge)]
impl EdgeWrapper {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        todo!()
    }

    #[wasm_bindgen(getter)]
    pub fn id(&self) -> EdgeID {
        EdgeID(self.0.id().into())
    }
}

#[wasm_bindgen(js_name = Node)]
pub struct NodeWrapper(Node);

#[wasm_bindgen(js_class = Node)]
impl NodeWrapper {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        todo!()
    }

    #[wasm_bindgen(getter)]
    pub fn id(&self) -> NodeID {
        NodeID(self.0.id().into())
    }
}

#[wasm_bindgen]
pub struct Datahog {
    root_id: NodeID,
    broker: Broker<BackIn, BackOut>,
}

#[wasm_bindgen]
impl Datahog {
    pub async fn new() -> Self {
        let mut broker = Broker::new();
        let mut b_clone = broker.clone();
        spawn_local(async move {
            loop {
                console_log!("Looping");
                b_clone.emit_msg_in(BackIn::Simulate).unwrap();
                wait_ms(1000).await;
            }
        });

        match Background::new().await {
            Ok(bg) => {
                broker.add_handler(Box::new(bg)).await.unwrap();
                Self {
                    root_id: NodeID(U256::zero()),
                    broker,
                }
            }
            Err(err) => panic!("Couldn't initialize Background: {err:?}"),
        }
    }

    #[wasm_bindgen(getter, js_name = rootNodeID)]
    pub fn root_node_id(&self) -> NodeID {
        NodeID(self.root_id.0.clone())
    }

    pub fn get_node(&mut self, id: NodeID, callback: Function) {
        self.broker
            .emit_msg_in(BackIn::GetNode(id.0, callback))
            .unwrap();
    }

    pub fn get_edge(&mut self, id: EdgeID, callback: Function) {
        self.broker
            .emit_msg_in(BackIn::GetEdge(id.0, callback))
            .unwrap();
    }
}

#[derive(Debug)]
struct DummySource {
    id: U256,
    _transactions_out: mpsc::Sender<Transaction>,
    transactions_out_rx: Option<mpsc::Receiver<Transaction>>,
}

impl DummySource {
    fn new() -> Self {
        let (tx, rx) = mpsc::channel(10);
        Self {
            id: U256::rnd(),
            _transactions_out: tx,
            transactions_out_rx: Some(rx),
        }
    }
}

#[async_trait::async_trait]
impl Source for DummySource {
    async fn capabilities(&self) -> anyhow::Result<SourceCapabilities> {
        return Ok(SourceCapabilities {
            id: self.id.clone().into(),
            can_fetch: true,
            can_create: true,
            can_update: true,
            can_search: false,
        });
    }

    async fn subscribe(
        &mut self,
        _store: mpsc::Receiver<Transaction>,
    ) -> anyhow::Result<mpsc::Receiver<Transaction>> {
        match self.transactions_out_rx.take() {
            Some(rx) => Ok(rx),
            None => Err(anyhow::anyhow!("Already gave receiver")),
        }
    }
}

#[derive(Debug, Clone)]
enum BackIn {
    GetNode(U256, Function),
    GetEdge(U256, Function),
    Simulate,
}

#[derive(Debug, Clone)]
enum BackOut {
    _Nope,
}

struct Background {
    nodes: HashMap<U256, Function>,
    edges: HashMap<U256, Function>,
    source_id: SourceID,
    wv: WorldView,
}

impl Background {
    async fn new() -> Result<Self> {
        let mut wv = WorldView::new();
        let ds = DummySource::new();
        let source_id: SourceID = ds.id.clone().into();
        wv.add_source(Box::new(ds)).await?;
        wv.add_transactions(
            &source_id,
            vec![Transaction {
                timestamp: now() as i128,
                records: vec![Record::Node(RecordCUD {
                    id: structs::NodeID::zero(),
                    create: Some((NodeKind::Label, 0)),
                    updates: vec![],
                })],
            }],
        );
        Ok(Self {
            wv,
            source_id,
            nodes: HashMap::new(),
            edges: HashMap::new(),
        })
    }

    fn get_node(&mut self, id: U256, callback: Function) -> Option<BackOut> {
        self.nodes.insert(id, callback);
        None
    }

    fn get_edge(&mut self, id: U256, callback: Function) -> Option<BackOut> {
        self.edges.insert(id, callback);
        None
    }

    async fn simulate(&mut self) -> Option<BackOut> {
        console_log!("Simulating");
        let node_id = structs::NodeID::rnd();
        let node = Transaction {
            timestamp: now() as i128,
            records: vec![Record::Node(RecordCUD {
                id: node_id.clone(),
                create: Some((NodeKind::Render(BFRender::Markdown), 0)),
                updates: vec![],
            })],
        };
        let edge = Transaction {
            timestamp: now() as i128,
            records: vec![Record::Edge(RecordCUD {
                id: structs::EdgeID::rnd(),
                create: Some(EdgeKind::Definition {
                    object: node_id.clone(),
                    label: structs::NodeID::zero(),
                }),
                updates: vec![],
            })],
        };
        self.wv.add_transactions(&self.source_id, vec![node, edge]);
        if let Err(e) = self.fetch().await {
            console_error!("While fetching: {e:?}");
        }
        None
    }

    async fn fetch(&mut self) -> Result<()> {
        let (_, nodes, edges) = self.wv.fetch().await?;
        for id in nodes {
            if let Some(cb) = self.nodes.get(&id) {
                if let Some(node) = self.wv.get_node(&id) {
                    if let Err(e) = cb.call1(&JsValue::NULL, &NodeWrapper(node).into()) {
                        console_error!("Error in node callback for {id}: {e:?}");
                    }
                }
            }
        }
        for id in edges {
            if let Some(cb) = self.edges.get(&id) {
                if let Some(edge) = self.wv.get_edge(&id) {
                    if let Err(e) = cb.call1(&JsValue::NULL, &EdgeWrapper(edge).into()) {
                        console_error!("Error in edge callback for {id}: {e:?}");
                    }
                }
            }
        }
        Ok(())
    }
}

#[platform_async_trait()]
impl SubsystemHandler<BackIn, BackOut> for Background {
    async fn messages(&mut self, msgs: Vec<BackIn>) -> Vec<BackOut> {
        let mut out = vec![];
        for msg in msgs {
            match msg {
                BackIn::GetEdge(id, cb) => self.get_edge(id, cb),
                BackIn::GetNode(id, cb) => self.get_node(id, cb),
                BackIn::Simulate => self.simulate().await,
            }
            .map(|o| out.push(o));
        }
        out
    }
}
