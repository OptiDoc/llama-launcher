/**
 * Sidebar component.
 */

"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, VariantProps } from "class-variance-authority";
import { PanelLeftIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSidebar } from "./sidebar-types";
import { SIDEBAR_WIDTH, SIDEBAR_WIDTH_MOBILE } from "./sidebar-types";

const sidebarVariants = cva(
  "fixed z-40 flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-linear",
  {
    variants: {
      side: {
        left: "top-0 left-0",
        right: "top-0 right-0",
      },
    },
    defaultVariants: {
      side: "left",
    },
  }
);

const sidebarVariantOverrides = {
  sidebar: "data-[state=open]:sm:data-[state=open]:translate-x-0 data-[state=closed]:sm:data-[state=closed]:-translate-x-full",
  floating: "data-[state=open]:sm:data-[state=open]:translate-x-0 data-[state=closed]:sm:data-[state=closed]:-translate-x-full inset-y-0 left-0 z-10 border-r",
  inset: "data-[state=open]:sm:data-[state=open]:translate-x-0 data-[state=closed]:sm:data-[state=closed]:-translate-x-full inset-y-0 left-0 z-10 border-r",
};

interface SidebarProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof sidebarVariants> {
  side?: "left" | "right";
  variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
}

function Sidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  className,
  children,
  ...props
}: SidebarProps) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

  if (collapsible === "none") {
    return (
      <div
        data-slot="sidebar"
        className={cn(
          "bg-sidebar text-sidebar-foreground flex h-full w-(--sidebar-width) flex-col",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
        <SheetContent
          data-sidebar="sidebar"
          data-slot="sidebar"
          data-mobile="true"
          className="bg-sidebar text-sidebar-foreground w-(--sidebar-width) p-0 [&>button]:hidden"
          style={{ "--sidebar-width": SIDEBAR_WIDTH_MOBILE } as React.CSSProperties}
          side={side}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Sidebar</SheetTitle>
            <SheetDescription>Displays the navigation menu.</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      className={cn("group peer text-sidebar-foreground group/sidebar-wrapper", className)}
      style={{"--sidebar-width": SIDEBAR_WIDTH} as React.CSSProperties}
      {...props}
    >
      <div
        className={cn(
          sidebarVariants({ side }),
          sidebarVariantOverrides[variant],
          "data-[collapsed=false]:hover:visible group-data-[collapsed=true]:hover:visible",
          "data-[state=open]:translate-x-0 data-[state=closed]:-translate-x-full",
          "data-[state=open]:sm:data-[state=open]:translate-x-0",
          "data-[state=closed]:sm:data-[state=closed]:-translate-x-full",
          "data-[state=closed]:sm:data-[state=closed]:hover:visible",
          className
        )}
        data-slot="sidebar"
        data-state={state}
        data-collapsible={state === "collapsed" ? collapsible : ""}
        data-variant={variant}
      >
        {children}
      </div>
    </div>
  );
}
