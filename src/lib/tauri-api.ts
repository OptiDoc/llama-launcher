/**
 * Tauri API bridge — typed wrappers for every Rust command in the backend.
 *
 * When running outside Tauri (plain browser), every call returns null/empty
 * so the UI can render honest empty states. No fake data is ever injected.
 */

export * from "./types";
export { isTauri, invoke, invokeWithChannel } from "./invoke";
export { tauri } from "./commands";
export { formatBytes, formatUptime } from "./tauri-format";
