"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Copy } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      variant="ghost" size="icon"
      className={cn("size-6 text-foreground/55 hover:text-foreground", className)}
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
          toast({
            title: "Copied",
            description: text.slice(0, 50) + (text.length > 50 ? "…" : ""),
          });
        } catch { /* clipboard unavailable */ }
      }}
      aria-label="Copy"
    >
      {copied ? <CheckCircle2 className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
    </Button>
  );
}
