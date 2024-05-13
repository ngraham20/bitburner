use wasm_bindgen::{
    prelude::*,
    JsValue,
};

// thank you github.com/paulcdejean
#[wasm_bindgen]
extern "C" {
    // Continue adding more imported structs from Bitburner and their associated
    // methods in here.
    //
    // For object attributes, skip to after this `extern` block.

    #[wasm_bindgen]
    fn alert(msg: &str);

    pub type NS;

    #[wasm_bindgen(method)]
    pub fn tprint(
        this: &NS,
        print: &str,
    );

    #[wasm_bindgen(method)]
    pub fn scan(
        this: &NS,
        scan: Option<&str>,
    ) -> Vec<JsValue>;

    #[wasm_bindgen(catch, method)]
    pub fn nuke(
        this: &NS,
        host: &str,
    ) -> Result<(), JsValue>;

    #[wasm_bindgen(catch, method)]
    pub fn brutessh(
        this: &NS,
        hostname: &str,
    ) -> Result<(), JsValue>;

    #[wasm_bindgen(catch, method)]
    pub fn ftpcrack(
        this: &NS,
        hostname: &str,
    ) -> Result<(), JsValue>;

    #[wasm_bindgen(catch, method)]
    pub fn relaysmtp(
        this: &NS,
        hostname: &str,
    ) -> Result<(), JsValue>;

    #[wasm_bindgen(catch, method)]
    pub fn httpworm(
        this: &NS,
        hostname: &str,
    ) -> Result<(), JsValue>;

    #[wasm_bindgen(catch, method)]
    pub fn sqlinject(
        this: &NS,
        hostname: &str,
    ) -> Result<(), JsValue>;

    #[wasm_bindgen(method)]
    pub fn getServer(
        this: &NS,
        host: Option<&str>,
    ) -> Server;

    pub type Server;
}