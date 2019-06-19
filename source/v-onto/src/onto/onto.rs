use std::collections::HashMap;

#[derive(PartialEq, Debug)]
pub enum RelType {
    Sub,
    Super,
}

pub struct Onto {
    pub relations: HashMap<String, HashMap<String, RelType>>,
}
