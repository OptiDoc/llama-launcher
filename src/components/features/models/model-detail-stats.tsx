/**
 * Model detail view — stats tiles.
 */

"use client";

import { Card, CardContent } from "@/components/ui/card";

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-3 shadow-none">
      <CardContent className="p-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-lg font-semibold">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export { StatTile };
