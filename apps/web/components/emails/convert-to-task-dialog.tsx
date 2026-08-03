"use client";

import { useState, type FormEvent } from "react";
import { ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { useProjects } from "@/lib/query/use-projects";
import { useBoards } from "@/lib/query/use-boards";
import { useConvertEmailToTask } from "@/lib/query/use-emails";
import { cn } from "@/lib/utils/cn";

/**
 * SAD §5 `POST /emails/:id/convert-to-task` — manual promotion UI (SAD
 * §7.3 Email Dashboard's "convert-to-task action"). A project must be
 * picked before its boards are fetched, so this is a small two-step form
 * rather than a single flat dropdown.
 */
export function ConvertToTaskDialog({ emailId, emailSubject }: { emailId: string; emailSubject: string }) {
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [boardId, setBoardId] = useState("");
  const [priority, setPriority] = useState("medium");

  const projectsQuery = useProjects();
  const boardsQuery = useBoards(projectId);
  const convertMutation = useConvertEmailToTask(emailId);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!boardId) return;
    convertMutation.mutate(
      { boardId, priority },
      {
        onSuccess: () => {
          setOpen(false);
          setProjectId("");
          setBoardId("");
        }
      }
    );
  }

  const selectClass =
    "flex h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground shadow-sm focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="secondary" size="sm">
          <ListPlus className="h-3.5 w-3.5" />
          Convert to task
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Convert to task</SheetTitle>
        </SheetHeader>
        <p className="text-sm text-muted-foreground">&ldquo;{emailSubject}&rdquo;</p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="project">Project</Label>
            <select
              id="project"
              className={selectClass}
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setBoardId("");
              }}
              required
            >
              <option value="" disabled>
                Select a project…
              </option>
              {projectsQuery.data?.items.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="board">Board</Label>
            <select
              id="board"
              className={selectClass}
              value={boardId}
              onChange={(e) => setBoardId(e.target.value)}
              disabled={!projectId}
              required
            >
              <option value="" disabled>
                {projectId ? "Select a board…" : "Pick a project first"}
              </option>
              {boardsQuery.data?.boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="priority">Priority</Label>
            <select
              id="priority"
              className={selectClass}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {convertMutation.isError && (
            <p className="text-sm text-danger" role="alert">
              {convertMutation.error.message}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <SheetClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </SheetClose>
            <Button type="submit" disabled={!boardId || convertMutation.isPending} className={cn(convertMutation.isPending && "opacity-70")}>
              {convertMutation.isPending ? "Creating…" : "Create task"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
