/**
 * Launch dialog logic — state, effects, handlers.
 */

"use client";

import * as React from "react";
import { useLlamaStore, pickPort } from "@/lib/llama-store";
import { validatePort, validateHost } from "./launch-validation";
import { buildGpuOptions } from "./gpu-options";
import type { LlamaProfile } from "@/lib/llama-store";

export interface LaunchDialogState {
  name: string;
  modelId: string;
  profileId: string;
  port: string;
  host: string;
  gpu: string;
  errors: { port?: string; host?: string };
  downloaded: unknown[];
  gpuOptions: unknown[];
  selectedModel: unknown;
  selectedModelMissing: boolean;
  overVram: boolean;
  overRam: boolean;
  profileOptions: LlamaProfile[];
  canLaunch: boolean;
}

export function useLaunchDialogLogic() {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [modelId, setModelId] = React.useState("");
  const [profileId, setProfileId] = React.useState("");
  const [port, setPort] = React.useState("");
  const [host, setHost] = React.useState("127.0.0.1");
  const [gpu, setGpu] = React.useState("");
  const [errors, setErrors] = React.useState<{ port?: string; host?: string }>({});

  const models = useLlamaStore((s) => s.models);
  const profiles = useLlamaStore((s) => s.profiles);
  const activeWorkspaceId = useLlamaStore((s) => s.activeWorkspaceId);
  const systemCapabilities = useLlamaStore((s) => s.systemCapabilities);
  const startInstance = useLlamaStore((s) => s.startInstance);
  const setActiveConsole = useLlamaStore((s) => s.setActiveConsole);
  const setConsoleOpen = useLlamaStore((s) => s.setConsoleOpen);

  const downloaded = React.useMemo(() => models.filter((m) => m.downloaded && !m.missing && !m.downloading), [models]);

  const gpuOptions = React.useMemo(() => buildGpuOptions(systemCapabilities), [systemCapabilities]);

  React.useEffect(() => {
    if (!open) return;
    setName("");
    setPort(String(pickPort()));
    setHost("127.0.0.1");
    setErrors({});
    const caps = useLlamaStore.getState().systemCapabilities;
    setGpu(caps.gpu_name || "cpu");
    const dl = useLlamaStore.getState().models.filter((m) => m.downloaded && !m.missing && !m.downloading);
    setModelId(dl[0]?.id ?? "");
    setProfileId("");
  }, [open]);

  const selectedModel = models.find((m) => m.id === modelId);
  const selectedModelMissing = selectedModel?.missing === true;
  const overVram = selectedModel ? selectedModel.sizeGb > systemCapabilities.gpu_vram_gb : false;
  const overRam = selectedModel ? selectedModel.sizeGb > systemCapabilities.ram_gb : false;

  const profileOptions = React.useMemo(() => {
    const selectedModel = models.find((m) => m.id === modelId);
    return profiles.filter((p) => {
      if (p.scope === "global") return true;
      if (selectedModel && p.modelId === selectedModel.id) return true;
      if (p.workspaceId === null) return true;
      if (p.workspaceId === activeWorkspaceId) return true;
      return false;
    });
  }, [profiles, models, modelId, activeWorkspaceId]);

  React.useEffect(() => {
    if (!open) return;
    if (profileOptions.length > 0 && !profileOptions.some((p) => p.id === profileId)) {
      setProfileId(profileOptions[0].id);
    }
  }, [open, profileOptions, profileId]);

  const canLaunch =
    !!name &&
    !!modelId &&
    !!port &&
    !!host &&
    !!gpu &&
    !errors.port &&
    !errors.host &&
    !selectedModelMissing &&
    !overVram &&
    !overRam;

  const onLaunch = () => {
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) return;
    const instanceId = startInstance({
      name,
      model: modelId,
      profile: profileId,
      port: Number(port),
      host,
      gpu,
    });
    if (instanceId) {
      setActiveConsole(instanceId);
      setConsoleOpen(true);
      setOpen(false);
    }
  };

  const clearError = (field: "port" | "host") => {
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  return {
    open,
    setOpen,
    name,
    setName,
    modelId,
    setModelId,
    profileId,
    setProfileId,
    port,
    setPort,
    host,
    setHost,
    gpu,
    setGpu,
    errors,
    clearError,
    selectedModel,
    systemCapabilities,
    setErrors,
    downloaded,
    gpuOptions,
    selectedModelMissing,
    overVram,
    overRam,
    profileOptions,
    canLaunch,
    onLaunch,
  };
}
