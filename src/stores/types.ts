import type { ModelsSlice } from "@/stores/models-slice";
import type { InstancesSlice } from "@/stores/instances-slice";
import type { DownloadsSlice } from "@/stores/downloads-slice";
import type { ProfilesSlice } from "@/stores/profiles-slice";
import type { ReleasesSlice } from "@/stores/releases-slice";
import type { WorkspacesSlice } from "@/stores/workspaces-slice";
import type { NotificationsSlice } from "@/stores/notifications-slice";
import type { SystemSlice } from "@/stores/system-slice";

export type LlamaStore = ModelsSlice & InstancesSlice & DownloadsSlice & ProfilesSlice & ReleasesSlice & WorkspacesSlice & NotificationsSlice & SystemSlice;
