/**
 * Local dev fixture seed (Implementation Guide Phase 2 Definition of Done:
 * "seed script populates a demo org fully navigable"). Phase 2 Backend
 * Foundation scope: org, users, notifications, projects, boards, tasks
 * (with task_activity), and a handful of audit_log entries so the Settings →
 * Audit Log and Users & Roles views have real data to render against.
 */
import { PrismaClient, ActorType } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const org = await prisma.organization.create({
    data: { name: "Acme Ops Demo", plan: "pro" }
  });

  const owner = await prisma.user.create({
    data: { orgId: org.id, email: "priya@acme.test", name: "Priya Shah", role: "owner" }
  });

  const [marcus, sarah] = await Promise.all([
    prisma.user.create({
      data: { orgId: org.id, email: "marcus@acme.test", name: "Marcus Lee", role: "admin" }
    }),
    prisma.user.create({
      data: { orgId: org.id, email: "sarah@acme.test", name: "Sarah Kim", role: "member" }
    })
  ]);

  await prisma.notification.create({
    data: {
      orgId: org.id,
      userId: owner.id,
      type: "system.welcome",
      payload: { title: "Welcome to AI Operations Manager", description: "Your workspace is ready." }
    }
  });

  const portalProject = await prisma.project.create({
    data: {
      orgId: org.id,
      name: "Client Portal Redesign",
      status: "active",
      health: "on_track",
      startDate: new Date("2026-05-01"),
      targetDate: new Date("2026-08-15")
    }
  });

  const infraProject = await prisma.project.create({
    data: {
      orgId: org.id,
      name: "Q3 Infra Migration",
      status: "active",
      health: "at_risk",
      startDate: new Date("2026-06-01"),
      targetDate: new Date("2026-09-01")
    }
  });

  const portalBoard = await prisma.board.create({
    data: { orgId: org.id, projectId: portalProject.id, name: "Portal Kanban", type: "kanban" }
  });

  const infraBoard = await prisma.board.create({
    data: { orgId: org.id, projectId: infraProject.id, name: "Infra Kanban", type: "kanban" }
  });

  const taskFixtures = [
    {
      board: portalBoard,
      title: "Design new onboarding flow",
      status: "in_progress" as const,
      priority: "high" as const,
      assignee: sarah,
      dueDate: new Date("2026-07-10")
    },
    {
      board: portalBoard,
      title: "Set up component library",
      status: "done" as const,
      priority: "medium" as const,
      assignee: marcus,
      dueDate: new Date("2026-06-20")
    },
    {
      board: portalBoard,
      title: "Client feedback review",
      status: "todo" as const,
      priority: "medium" as const,
      assignee: sarah,
      dueDate: new Date("2026-07-15")
    },
    {
      board: infraBoard,
      title: "Migrate staging database",
      status: "in_review" as const,
      priority: "urgent" as const,
      assignee: marcus,
      dueDate: new Date("2026-07-05")
    },
    {
      board: infraBoard,
      title: "Update CI/CD pipeline",
      status: "blocked" as const,
      priority: "high" as const,
      assignee: owner,
      dueDate: new Date("2026-06-25") // in the past relative to the demo "current date" — deliberately overdue
    },
    {
      board: infraBoard,
      title: "Decommission legacy worker",
      status: "backlog" as const,
      priority: "low" as const,
      assignee: null,
      dueDate: null
    }
  ];

  for (const fixture of taskFixtures) {
    const task = await prisma.task.create({
      data: {
        orgId: org.id,
        boardId: fixture.board.id,
        title: fixture.title,
        status: fixture.status,
        priority: fixture.priority,
        assigneeId: fixture.assignee?.id ?? null,
        dueDate: fixture.dueDate,
        source: "manual"
      }
    });

    await prisma.taskActivity.create({
      data: { taskId: task.id, actorId: owner.id, actorType: ActorType.user, action: "created" }
    });

    await prisma.auditLog.create({
      data: {
        orgId: org.id,
        actorId: owner.id,
        actorType: ActorType.user,
        action: "task.created",
        resourceType: "task",
        resourceId: task.id,
        metadata: { title: task.title, boardId: task.boardId }
      }
    });
  }

  await prisma.auditLog.create({
    data: {
      orgId: org.id,
      actorId: owner.id,
      actorType: ActorType.user,
      action: "organization.created",
      resourceType: "organization",
      resourceId: org.id,
      metadata: { name: org.name }
    }
  });

  console.warn(`Seeded org ${org.id} with ${taskFixtures.length} tasks across 2 projects.`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
