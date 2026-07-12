import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ErrorBoundary } from "@/components/error-boundary";

export const metadata: Metadata = {
  title: "LlamaLauncher — llama.cpp Server Manager",
  description: "Launch, monitor and manage local llama.cpp server instances with per-instance consoles.",
  keywords: ["llama.cpp", "llama-server", "local LLM", "launcher", "Next.js"],
  authors: [{ name: "LlamaLauncher" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="antialiased bg-background text-foreground"
        style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
      >
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
        <Toaster />
      </body>
    </html>
  );
}
