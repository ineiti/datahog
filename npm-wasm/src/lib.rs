use datahog::worldview::WorldView;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Datahog {
    wv: WorldView,
    count: i32,
}

#[wasm_bindgen]
impl Datahog {
    pub fn new() -> Self {
        Self {
            wv: WorldView::new(),
            count: 10,
        }
    }

    pub fn increase(&mut self) -> i32 {
        self.count += 1;
        self.count
    }
}

#[wasm_bindgen]
pub fn new_dh() -> Datahog {
    Datahog::new()
}
