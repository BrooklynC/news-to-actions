"use client";

import { useState } from "react";
import { ClampText } from "@/components/ui/ClampText";

export type ActionItemRowItem = {
  id: string;
  title: string;
  description?: string;
  dueDate?: string | null;
  priority?: string | null;
  status: string;
  personaId?: string | null;
  assigneeUserId?: string | null;
};

type Persona = { id: string; name: string };
type Member = { user: { id: string; email: string | null } };

type ActionItemRowProps = {
  item: ActionItemRowItem;
  personas: Persona[];
  members: Member[];
  updateActionItem: (formData: FormData) => void;
  /** Optional: article title for display */
  articleTitle?: string | null;
  /** Optional: History content (e.g. ActionItemAudit) rendered by parent in Server tree */
  children?: React.ReactNode;
};

export function ActionItemRow({
  item,
  personas,
  members,
  updateActionItem,
  articleTitle,
  children,
}: ActionItemRowProps) {
  const [editing, setEditing] = useState(false);

  const handleCancel = () => setEditing(false);

  return (
    <li className="rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-sm transition-shadow transition-transform duration-200 hover:shadow-md hover:-translate-y-0.5 active:shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50 sm:p-6">
      {editing ? (
        <form action={updateActionItem} className="space-y-3">
          <input type="hidden" name="id" value={item.id} />
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Title</label>
            <input
              type="text"
              name="title"
              defaultValue={item.title}
              required
              minLength={3}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="Title"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Description</label>
            <input
              type="text"
              name="description"
              defaultValue={item.description ?? ""}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="Description"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Status</label>
              <select
                name="status"
                defaultValue={item.status}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="OPEN">OPEN</option>
                <option value="DONE">DONE</option>
                <option value="DISMISSED">DISMISSED</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Priority</label>
              <select
                name="priority"
                defaultValue={item.priority ?? ""}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="">—</option>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Due date</label>
              <input
                type="text"
                name="dueDate"
                defaultValue={item.dueDate ?? ""}
                placeholder="YYYY-MM-DD"
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Persona</label>
              <select
                name="personaId"
                defaultValue={item.personaId ?? ""}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="">—</option>
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Assignee</label>
              <select
                name="assigneeUserId"
                defaultValue={item.assigneeUserId ?? ""}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="">—</option>
                {members.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.email ?? m.user.id}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors transition-transform duration-150 hover:bg-zinc-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-600 transition-colors transition-transform duration-150 hover:bg-zinc-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <p
                className="block max-w-full truncate font-medium text-zinc-900 dark:text-zinc-100"
                title={item.title}
              >
                {item.title}
              </p>
              {item.description && (
                <div className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                  <ClampText
                    text={item.description}
                    lines={2}
                    moreLabel="Read more"
                    lessLabel="Show less"
                  />
                </div>
              )}
              {articleTitle != null && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {articleTitle}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors duration-150 ${
                  item.status === "OPEN"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                    : item.status === "DONE"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {item.status}
              </span>
              {(personas.find((p) => p.id === item.personaId)?.name ?? null) && (
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 transition-colors duration-150 dark:bg-zinc-800 dark:text-zinc-400">
                  {personas.find((p) => p.id === item.personaId)?.name}
                </span>
              )}
              {(members.find((m) => m.user.id === item.assigneeUserId)?.user?.email ?? null) && (
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 transition-colors duration-150 dark:bg-zinc-800 dark:text-zinc-400">
                  {members.find((m) => m.user.id === item.assigneeUserId)?.user?.email}
                </span>
              )}
              {item.priority && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {item.priority}
                </span>
              )}
              {item.dueDate && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Due {item.dueDate}
                </span>
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition-colors transition-transform duration-150 hover:bg-zinc-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              Edit
            </button>
          </div>
          {children && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-zinc-400 hover:text-zinc-200">
                History
              </summary>
              <div className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/50">
                {children}
              </div>
            </details>
          )}
        </>
      )}
    </li>
  );
}
