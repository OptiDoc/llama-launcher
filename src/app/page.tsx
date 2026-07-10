"use client";

import * as React from "react";
import { AppShell } from "@/components/layout/app-shell";
import type { Page } from "@/components/layout/sidebar";
import { Dashboard } from "@/components/pages/dashboard";
import { InstancesPage } from "@/components/pages/instances";
import { ModelsPage } from "@/components/pages/models";
import { ProfilesPage } from "@/components/pages/profiles";
import { ReleasesPage } from "@/components/pages/releases";
import { LogsPage } from "@/components/pages/logs";
import { SettingsPage } from "@/components/pages/settings";

export default function Home() {
  const [activePage, setActivePage] = React.useState<Page>("dashboard");

  const pages: Record<Page, React.ReactNode> = {
    dashboard: <Dashboard />,
    instances: <InstancesPage />,
    models: <ModelsPage />,
    profiles: <ProfilesPage />,
    releases: <ReleasesPage />,
    logs: <LogsPage />,
    settings: <SettingsPage />,
  };

  return (
    <AppShell activePage={activePage} onNavigate={setActivePage}>
      {pages[activePage]}
    </AppShell>
  );
}
