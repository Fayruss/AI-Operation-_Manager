"use client";

import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { mockOrganizations, mockOrganization } from "@/lib/mock/mock-data";

/**
 * SAD §6.2 top bar "org switcher" / PRD-implied multi-org support for users
 * who belong to more than one organization. Backed by mock data until
 * Settings' org management (SAD §7.8) exists.
 */
export function OrgSwitcher() {
  const [activeOrgId, setActiveOrgId] = useState(mockOrganization.id);
  const activeOrg = mockOrganizations.find((o) => o.id === activeOrgId) ?? mockOrganization;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 max-w-[130px] justify-between gap-2 px-2 sm:max-w-[200px]">
          <span className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm font-medium">{activeOrg.name}</span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {mockOrganizations.map((org) => (
          <DropdownMenuItem key={org.id} onSelect={() => setActiveOrgId(org.id)}>
            <span className="flex-1 truncate">{org.name}</span>
            {org.id === activeOrgId && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <Plus className="h-4 w-4" />
          <span>Create organization</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
