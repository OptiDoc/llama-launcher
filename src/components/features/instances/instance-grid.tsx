"use client";
import type { LlamaInstance } from "@/lib/llama-store";
import { InstanceCard } from "./instance-card";

function InstanceGrid({
  instances,
  onSelect,
}: {
  instances: LlamaInstance[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {instances.map((inst) => (
        <InstanceCard key={inst.id} instance={inst} onSelect={onSelect} />
      ))}
    </div>
  );
}

export { InstanceGrid };
