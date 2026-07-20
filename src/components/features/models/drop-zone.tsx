"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { FolderOpen } from "lucide-react";

export function DropZone({ onFilesSelected }: { onFilesSelected: (files: FileList) => void }) {
  const [dragActive, setDragActive] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files);
    }
  };

  const handleClick = () => inputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
    }
  };

  return (
    <div
      className={cn(
        "relative rounded-lg border-2 border-dashed p-6 text-center transition-colors",
        dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
      )}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(); } }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".gguf"
        multiple
        onChange={handleFileChange}
        className="sr-only"
        aria-label="Select GGUF model files"
      />
      <div className="flex flex-col items-center gap-2">
        <div className="grid size-10 place-items-center rounded-full bg-muted">
          <FolderOpen className="size-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">
          {dragActive ? "Drop GGUF files here" : "Drag & drop .gguf files or click to browse"}
        </p>
        <p className="text-xs text-muted-foreground">Files will be imported to your models directory</p>
      </div>
    </div>
  );
}
