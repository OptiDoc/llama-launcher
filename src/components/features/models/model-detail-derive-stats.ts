/**
 * Model detail view helpers.
 */

import type { LlamaModel } from "@/lib/types-model";

function deriveModelStats(model: LlamaModel) {
  return {
    timesLoaded: 0,
    totalTokens: 0,
    avgTps: 0,
    lastUsed: "—",
    daily: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => ({ day: d, tokens: 0 })),
    context: model.contextLength,
    embedding: model.embedding ?? 0,
    params: model.params ?? 0,
    type: model.architecture,
    format: model.quant,
    architecture: model.architecture,
    tokenizer: "unknown",
    created: model.uploadedAt,
    modified: new Date(model.addedAt).toISOString().slice(0, 10),
    fileSize: model.sizeGb ?? 0,
  };
}

export { deriveModelStats };
