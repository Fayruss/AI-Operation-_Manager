import type { AppUser, NotificationItem, Organization, Project } from "@ai-ops/types";

/**
 * Mock data for Phase 1. Every dashboard route in this phase is an "empty
 * state" per SAD §6.6 / Implementation Guide Phase 3 — real data arrives in
 * Phase 4+ once the Task/Project API (API Contract Pattern A) exists. These
 * fixtures let the shell render representative UI without a live backend.
 */

export const mockOrganization: Organization = {
  id: "org_demo",
  name: "Acme Ops Demo",
  plan: "pro",
  createdAt: "2026-01-01T00:00:00Z"
};

export const mockCurrentUser: AppUser = {
  id: "u_demo_1",
  orgId: mockOrganization.id,
  email: "priya@acme.test",
  name: "Priya Shah",
  role: "owner",
  avatarUrl: null
};

export const mockOrganizations: Organization[] = [
  mockOrganization,
  { id: "org_demo_2", name: "Northwind Agency", plan: "free", createdAt: "2026-02-14T00:00:00Z" }
];

export const mockNotifications: NotificationItem[] = [
  {
    id: "n_1",
    orgId: mockOrganization.id,
    userId: mockCurrentUser.id,
    type: "system.welcome",
    payload: {
      title: "Welcome to AI Operations Manager",
      description: "Your workspace is set up. Connect email in Settings to get started."
    },
    read: false,
    createdAt: "2026-07-01T08:00:00Z"
  },
  {
    id: "n_2",
    orgId: mockOrganization.id,
    userId: mockCurrentUser.id,
    type: "system.info",
    payload: {
      title: "No AI agents connected yet",
      description: "Email/meeting intelligence activates in a later phase."
    },
    read: false,
    createdAt: "2026-07-01T08:05:00Z"
  },
  {
    id: "n_3",
    orgId: mockOrganization.id,
    userId: mockCurrentUser.id,
    type: "system.info",
    payload: { title: "Invite your team", description: "Add teammates from Settings → Users & Roles." },
    read: true,
    createdAt: "2026-06-29T12:00:00Z"
  }
];

export const mockProjects: Project[] = [
  {
    id: "p_1",
    orgId: mockOrganization.id,
    name: "Client Portal Redesign",
    status: "active",
    health: "on_track",
    startDate: "2026-05-01",
    targetDate: "2026-08-15"
  },
  {
    id: "p_2",
    orgId: mockOrganization.id,
    name: "Q3 Infra Migration",
    status: "active",
    health: "at_risk",
    startDate: "2026-06-01",
    targetDate: "2026-09-01"
  }
];
