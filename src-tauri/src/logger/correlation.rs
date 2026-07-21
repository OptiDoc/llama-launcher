use std::cell::RefCell;

thread_local! {
    static CORRELATION_ID: RefCell<Option<String>> = const { RefCell::new(None) };
}

pub fn set_correlation_id(id: String) {
    CORRELATION_ID.with(|c| *c.borrow_mut() = Some(id));
}

pub fn get_correlation_id() -> Option<String> {
    CORRELATION_ID.with(|c| c.borrow().clone())
}

pub fn clear_correlation_id() {
    CORRELATION_ID.with(|c| *c.borrow_mut() = None);
}

pub fn with_correlation_id<T, F: FnOnce(Option<&String>) -> T>(f: F) -> T {
    CORRELATION_ID.with(|c| f(c.borrow().as_ref()))
}
