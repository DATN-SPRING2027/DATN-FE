import { expect, it } from "vitest";
import type { CurrentUserResponse } from "@/lib/queries/auth/useAuth";
import type { Project } from "@/lib/queries/projects/useProjects";
import {
  applyTaskPermissions,
  canManageProjectWork,
  canModifyProjectTask,
} from "./work-permissions";
import type { WorkItem } from "./work-types";

const member: CurrentUserResponse = {
  id: "actor",
  name: "Actor",
  email: "a@example.test",
  organizationId: "org-a",
  roles: ["MEMBER"],
};
const project: Project = {
  id: "project-a",
  organizationId: "org-a",
  name: "Project",
  code: "PRJ",
  status: "ACTIVE",
  visibility: "PRIVATE",
  createdBy: "other",
  createdAt: "2026-10-01",
  updatedAt: "2026-10-01",
  leaders: [],
};
const task = { createdBy: "other", assigneeId: "other" };

it("restricts a Member to tasks they created or are assigned to", () => {
  expect(canManageProjectWork(member, project)).toBe(false);
  expect(canModifyProjectTask(member, project, task)).toBe(false);
  expect(
    canModifyProjectTask(member, project, { ...task, createdBy: member.id }),
  ).toBe(true);
  expect(
    canModifyProjectTask(member, project, { ...task, assigneeId: member.id }),
  ).toBe(true);
});

it("grants management only to a current Manager or an effective Leader of this Project", () => {
  expect(
    canModifyProjectTask({ ...member, roles: ["ADMIN"] }, project, task),
  ).toBe(true);
  expect(
    canManageProjectWork({ ...member, roles: ["TEAM_LEADER"] }, project),
  ).toBe(false);
  expect(
    canManageProjectWork(member, {
      ...project,
      leaders: [{ userId: member.id, fullName: "Actor", email: member.email }],
    }),
  ).toBe(true);
  expect(
    canManageProjectWork(member, {
      ...project,
      leaders: [
        { userId: "other", fullName: "Other", email: "other@example.test" },
      ],
    }),
  ).toBe(false);
});

it("denies missing identity, archived Projects and cross-organization authority", () => {
  expect(canModifyProjectTask(undefined, project, task)).toBe(false);
  expect(
    canManageProjectWork(
      { ...member, roles: ["ADMIN"], organizationId: "org-b" },
      project,
    ),
  ).toBe(false);
  expect(
    canModifyProjectTask(
      member,
      { ...project, status: "ARCHIVED" },
      { ...task, createdBy: member.id },
    ),
  ).toBe(false);
});

it("recomputes authority after demotion without preserving a cached allow on Tasks or Subtasks", () => {
  const item: WorkItem = {
    id: "task-a",
    key: "PRJ-1",
    title: "Task",
    type: "TASK",
    status: "TODO",
    priority: "MEDIUM",
    resolution: "UNRESOLVED",
    assignee: { id: "other", name: "Other", initials: "OT" },
    reporter: { id: "other", name: "Other", initials: "OT" },
    createdAt: "2026-10-01",
    dueDate: null,
    projectName: "Project",
    subtasks: { total: 1, completed: 0 },
    subtaskItems: [
      {
        id: "sub-a",
        key: "PRJ-2",
        summary: "Subtask",
        status: "TODO",
        done: false,
        reporter: { id: "other", name: "Other", initials: "OT" },
      },
    ],
  };
  const allowed = applyTaskPermissions(
    { ...member, roles: ["ADMIN"] },
    project,
    item,
  );
  expect(allowed.readOnly).toBe(false);
  const revoked = applyTaskPermissions(member, project, allowed);
  expect(revoked.readOnly).toBe(true);
  expect(revoked.subtaskItems?.[0].readOnly).toBe(true);
  expect(
    applyTaskPermissions(member, project, {
      ...item,
      reporter: { id: member.id, name: member.name, initials: "ME" },
    }).readOnly,
  ).toBe(false);
});
