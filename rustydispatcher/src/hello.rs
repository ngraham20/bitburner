use wasm_bindgen::JsValue;
use crate::ns::NS;

pub fn get_attribute<T>(
    object: &JsValue,
    field_name: &str,
    mapper: impl Fn(&JsValue) -> Option<T>,
) -> Result<Option<T>, JsValue> {
    js_sys::Reflect::get(object, &JsValue::from_str(field_name))
        .map(|x| mapper(&x))
}

pub fn hello(ns: &NS) {
    let mut buffer = "Hello, bitburner! I said ".to_owned();
    let args = get_attribute(ns, "args", |a| Some(js_sys::Array::from(a)))
        .unwrap()
        .unwrap();
    let args_iter = args.iter().map(|a| a.as_string().unwrap());

    for arg in args_iter {
        buffer += &arg;
        buffer += " ";
    }

    ns.tprint(&buffer);
}