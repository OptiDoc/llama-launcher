"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Server,
  Plus,
  Play,
  Square,
  Trash2,
  TerminalSquare,
  Cpu,
  Activity,
  MemoryStick,
  Clock,
  Network,
} from "lucide-react";
import {
  useLlamaStore,
  uptimeString,
  pickPort,
  type LlamaInstance,
} from "@/lib/llama-store";

const STATUS_STYLE: Record<LlamaInstance["status"], string> = {
  running: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  starting: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  stopping: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  error: "bg-red-500/15 text-red-700 dark:text-red-300",
  stopped: "bg-muted text-muted-foreground",
};

function StatusBadge({ status }: { status: LlamaInstance["status"] }) {
  const isLive = status === "running" || status === "starting" || status === "stopping";
  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1.5 text-[10px] font-semibold uppercase tracking-wide",
        STATUS_STYLE[status],
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full bg-current",
          isLive && status === "starting" && "animate-pulse",
          isLive && status === "stopping" && "animate-pulse",
        )}
      />
      {status}
    </Badge>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-white/50 px-2.5 py-1.5 dark:bg-black/15">
      <span className="grid size-6 place-items-center rounded-md bg-white/70 text-foreground/70 dark:bg-black/25">
        {icon}
      </span>
      <div className="min-w-0 leading-tight">
        <div className="text-[10px] font-medium uppercase tracking-wide text-foreground/55">
          {label}
        </div>
        <div className="truncate text-xs font-semibold">{value}</div>
      </div>
    </div>
  );
}

function InstanceCard({ instance }: { instance: LlamaInstance }) {
  const stopInstance = useLlamaStore((s) => s.stopInstance);
  const startInstance = useLlamaStore((s) => s.startInstance);
  const removeInstance = useLlamaStore((s) => s.removeInstance);
  const setActiveConsole = useLlamaStore((s) => s.setActiveConsole);

  const isRunning = instance.status === "running" || instance.status === "starting";
  const isStopped = instance.status === "stopped";

  const openConsole = () => setActiveConsole(instance.id);

  const restart = () => {
    startInstance({
      name: instance.name,
      model: instance.model,
      profile: instance.profile,
      port: instance.port,
      host: instance.host,
      gpu: instance.gpu,
    });
  };

  return (
    <Card className={cn("overflow-hidden border-0 shadow-sm", `card-${instance.color}`)}>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-white/60 dark:bg-black/20">
              <Server className="size-5" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold">{instance.name}</h3>
              <p className="truncate text-xs text-foreground/70">{instance.model}</p>
            </div>
          </div>
          <StatusBadge status={instance.status} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Stat icon={<Network className="size-3.5" />} label="Port" value={`:${instance.port}`} />
          <Stat icon={<Clock className="size-3.5" />} label="Uptime" value={uptimeString(instance.startedAt)} />
          <Stat icon={<Activity className="size-3.5" />} label="Tok/s" value={instance.tokensPerSec.toFixed(1)} />
          <Stat icon={<Cpu className="size-3.5" />} label="Req/min" value={String(instance.requestsPerMin)} />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-foreground/70">
            <span>Profile · {instance.profile}</span>
            <span className="font-mono">{instance.memoryMb > 0 ? `${instance.memoryMb} MB` : "—"}</span>
          </div>
          <Progress
            value={isRunning ? 55 + (instance.id.charCodeAt(4) % 35) : 0}
            className="h-1.5 bg-white/40 dark:bg-black/20"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="h-8 flex-1 bg-white/60 text-xs dark:bg-black/20"
            onClick={openConsole}
          >
            <TerminalSquare className="mr-1.5 size-3.5" />
            Console
          </Button>
          {isRunning ? (
            <Button
              size="sm"
              variant="secondary"
              className="h-8 bg-white/60 text-xs text-red-600 hover:bg-white/80 dark:bg-black/20 dark:text-red-300"
              onClick={() => stopInstance(instance.id)}
            >
              <Square className="mr-1.5 size-3.5" />
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-8 flex-1 text-xs"
              onClick={restart}
              disabled={instance.status === "stopping"}
            >
              <Play className="mr-1.5 size-3.5" />
              Start
            </Button>
          )}
          {isStopped && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
              onClick={() => removeInstance(instance.id)}
              title="Remove instance"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LaunchDialog() {
  const models = useLlamaStore((s) => s.models);
  const profiles = useLlamaStore((s) => s.profiles);
  const startInstance = useLlamaStore((s) => s.startInstance);
  const setActiveConsole = useLlamaStore((s) => s.setActiveConsole);
  const setConsoleOpen = useLlamaStore((s) => s.setConsoleOpen);

  const downloaded = React.useMemo(() => models.filter((m) => m.downloaded), [models]);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [model, setModel] = React.useState(downloaded[0]?.name ?? "");
  const [profile, setProfile] = React.useState(profiles[0]?.name ?? "");
  const [port, setPort] = React.useState<string>(String(pickPort()));
  const [host, setHost] = React.useState("127.0.0.1");
  const [gpu, setGpu] = React.useState("NVIDIA RTX 4070");

  React.useEffect(() => {
    if (open) {
      setName("");
      setModel(downloaded[0]?.name ?? "");
      setProfile(profiles[0]?.name ?? "");
      setPort(String(pickPort()));
      setHost("127.0.0.1");
      setGpu("NVIDIA RTX 4070");
    }
  }, [open]);

  const submit = () => {
    const safeName = name.trim() || `${model.split(" ")[0] || "llama"}-${port}`;
    const id = startInstance({
      name: safeName,
      model,
      profile,
      port: Number(port) || pickPort(),
      host,
      gpu,
    });
    setActiveConsole(id);
    setConsoleOpen(true);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 size-3.5" />
          Launch Instance
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Launch llama-server</DialogTitle>
          <DialogDescription>
            Configure a new instance. It will start streaming logs to its own console tab.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="inst-name">Name</Label>
            <Input
              id="inst-name"
              placeholder="e.g. chat-prod-01"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {downloaded.map((m) => (
                    <SelectItem key={m.id} value={m.name}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Profile</Label>
              <Select value={profile} onValueChange={setProfile}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select profile" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.name}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="inst-port">Port</Label>
              <Input
                id="inst-port"
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inst-host">Host</Label>
              <Input
                id="inst-host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>GPU</Label>
            <Select value={gpu} onValueChange={setGpu}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NVIDIA RTX 4070">NVIDIA RTX 4070</SelectItem>
                <SelectItem value="CPU">CPU</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={downloaded.length === 0 || profiles.length === 0}>
            <Play className="mr-1.5 size-3.5" />
            Launch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function InstancesPage() {
  const instances = useLlamaStore((s) => s.instances);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Instances</h1>
          <p className="text-sm text-muted-foreground">
            Launch, monitor and manage your llama.cpp server processes.
          </p>
        </div>
        <LaunchDialog />
      </div>

      {instances.length === 0 ? (
        <Card className="border-dashed shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="grid size-14 place-items-center rounded-2xl bg-accent">
              <Server className="size-7 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold">No instances yet</p>
              <p className="text-xs text-muted-foreground">
                Launch your first llama-server to get started.
              </p>
            </div>
            <div className="pt-1">
              <LaunchDialog />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {instances.map((inst) => (
            <InstanceCard key={inst.id} instance={inst} />
          ))}
        </div>
      )}
    </div>
  );
}
