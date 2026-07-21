/**
 * Launch dialog — validation.
 */

"use client";

export function validatePort(port: string): string | undefined {
  if (!port) return "Port is required";
  const num = Number(port);
  if (!Number.isInteger(num) || num < 1 || num > 65535) return "Invalid port number";
  return undefined;
}

export function validateHost(host: string): string | undefined {
  if (!host) return "Host is required";
  if (!/^[0-9a-zA-Z.-]+$/.test(host)) return "Invalid host format";
  return undefined;
}
