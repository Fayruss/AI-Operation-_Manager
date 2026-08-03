"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateProject } from "@/lib/query/use-projects";

/**
 * SAD §13.2 Command Center's "Create project → POST /projects (opens
 * quick-create form inline)." Self-contained (open state owned here, no
 * page-level wiring needed) so both the Projects page's "New project"
 * button and the Command Palette can trigger the same real flow.
 */
export function CreateProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const createMutation = useCreateProject();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate(
      { name: name.trim(), status: "active", health: "on_track", targetDate: targetDate || undefined },
      {
        onSuccess: (project) => {
          onOpenChange(false);
          setName("");
          setTargetDate("");
          router.push(`/app/projects/${project.id}`);
        }
      }
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>New project</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="project-name">Name</Label>
            <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Client redesign" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-target-date">Target date (optional)</Label>
            <Input id="project-target-date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </div>
          {createMutation.isError && <p className="text-xs text-danger">Couldn&apos;t create the project. Try again.</p>}
          <Button type="submit" disabled={createMutation.isPending || !name.trim()} className="w-full">
            <Plus className="h-4 w-4" />
            {createMutation.isPending ? "Creating…" : "Create project"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
