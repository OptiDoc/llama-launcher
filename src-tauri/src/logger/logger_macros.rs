#[macro_export]
macro_rules! log_debug {
    ($message:expr) => {
        $crate::logger::debug($message, "system", None)
    };
    ($message:expr, $category:expr) => {
        $crate::logger::debug($message, $category, None)
    };
    ($message:expr, $category:expr, $context:expr) => {
        $crate::logger::debug($message, $category, Some($context))
    };
}

#[macro_export]
macro_rules! log_info {
    ($message:expr) => {
        $crate::logger::info($message, "system", None)
    };
    ($message:expr, $category:expr) => {
        $crate::logger::info($message, $category, None)
    };
    ($message:expr, $category:expr, $context:expr) => {
        $crate::logger::info($message, $category, Some($context))
    };
}

#[macro_export]
macro_rules! log_success {
    ($message:expr) => {
        $crate::logger::success($message, "system", None)
    };
    ($message:expr, $category:expr) => {
        $crate::logger::success($message, $category, None)
    };
    ($message:expr, $category:expr, $context:expr) => {
        $crate::logger::success($message, $category, Some($context))
    };
}

#[macro_export]
macro_rules! log_warn {
    ($message:expr) => {
        $crate::logger::warn($message, "system", None)
    };
    ($message:expr, $category:expr) => {
        $crate::logger::warn($message, $category, None)
    };
    ($message:expr, $category:expr, $context:expr) => {
        $crate::logger::warn($message, $category, Some($context))
    };
}

#[macro_export]
macro_rules! log_error {
    ($message:expr) => {
        $crate::logger::error($message, "system", None)
    };
    ($message:expr, $category:expr) => {
        $crate::logger::error($message, $category, None)
    };
    ($message:expr, $category:expr, $context:expr) => {
        $crate::logger::error($message, $category, Some($context))
    };
}
