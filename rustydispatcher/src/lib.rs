mod ns;
use ns::NS;

use wasm_bindgen::{
    prelude::*,
    JsValue,
};

pub fn get_attribute<T>(
    object: &JsValue,
    field_name: &str,
    mapper: impl Fn(&JsValue) -> Option<T>,
) -> Result<Option<T>, JsValue> {
    js_sys::Reflect::get(object, &JsValue::from_str(field_name))
        .map(|x| mapper(&x))
}

mod hello;
#[wasm_bindgen]
pub async fn main_rs(ns: &NS) {
    hello::hello(ns);
}
