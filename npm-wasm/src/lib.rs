use std::collections::HashMap;

use datahog::worldview::WorldView;
use flarch::{
    broker::{Broker, SubsystemHandler},
    nodeids::U256,
    platform_async_trait,
    tasks::{spawn_local, wait_ms},
};
use js_sys::Function;
use wasm_bindgen::prelude::*;

use datahog::structs::Transaction;

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

#[wasm_bindgen]
pub struct Datahog {
    _wv: WorldView,
    broker: Broker<BackIn, BackOut>,
}

#[wasm_bindgen]
impl Datahog {
    pub async fn new() -> Self {
        let mut broker = Broker::new();
        broker
            .add_handler(Box::new(Background::new()))
            .await
            .unwrap();
        let mut b_clone = broker.clone();
        spawn_local(async move {
            loop {
                b_clone.emit_msg_in(BackIn::NOP).unwrap();
                wait_ms(1000).await;
            }
        });
        Self {
            _wv: WorldView::new(),
            broker,
        }
    }

    pub fn add_callback(&mut self, callback: Function) {
        self.broker
            .emit_msg_in(BackIn::RegisterCallback(U256::zero(), callback))
            .unwrap();
    }
}

#[derive(Debug, Clone)]
enum BackIn {
    RegisterCallback(U256, Function),
    NOP,
}

#[derive(Debug, Clone)]
enum BackOut {
    Nope,
}

struct Background {
    callbacks: HashMap<U256, Function>,
    count: usize,
}

impl Background {
    fn new() -> Self {
        Self {
            callbacks: HashMap::new(),
            count: 0,
        }
    }

    fn register(&mut self, storage: U256, callback: Function) -> BackOut {
        self.callbacks.insert(storage, callback);
        BackOut::Nope
    }

    fn nop(&mut self) -> BackOut {
        self.count += 1;
        if let Some(cb) = self.callbacks.iter_mut().next() {
            let tw = TransactionWrapper(Transaction {
                timestamp: self.count as i128,
                records: vec![],
            });
            if let Err(e) = cb.1.call1(&JsValue::NULL, &tw.into()) {
                web_sys::console::log_2(&"Error in callback(Transaction):".into(), &e);
            }
        }
        BackOut::Nope
    }
}

#[platform_async_trait()]
impl SubsystemHandler<BackIn, BackOut> for Background {
    async fn messages(&mut self, msgs: Vec<BackIn>) -> Vec<BackOut> {
        let out = msgs
            .into_iter()
            // .inspect(|msg| log::debug!("{_id}: DHTRouterIn: {msg:?}"))
            .map(|msg| match msg {
                BackIn::RegisterCallback(u256, function) => self.register(u256, function),
                BackIn::NOP => self.nop(),
            })
            // .inspect(|msg| log::debug!("{_id}: DHTRouterOut: {msg:?}"))
            .collect();
        out
    }
}
