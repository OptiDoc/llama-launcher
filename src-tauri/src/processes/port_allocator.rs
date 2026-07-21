use std::collections::HashSet;

#[derive(Debug)]
pub struct PortAllocator {
    used: HashSet<u16>,
    range: std::ops::Range<u16>,
}

impl PortAllocator {
    pub fn new(start: u16, end: u16) -> Self {
        Self {
            used: HashSet::new(),
            range: start..end,
        }
    }

    pub fn allocate(&mut self) -> Option<u16> {
        for port in self.range.clone() {
            if !self.used.contains(&port) && Self::is_port_free(port) {
                self.used.insert(port);
                return Some(port);
            }
        }
        None
    }

    pub fn release(&mut self, port: u16) {
        self.used.remove(&port);
    }

    fn is_port_free(port: u16) -> bool {
        std::net::TcpListener::bind(("127.0.0.1", port)).is_ok()
    }
}
