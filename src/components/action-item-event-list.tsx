import { listActionEvents } from "@/app/app/actions/actionItem.actions";

type ActionItemEventListProps = { actionId: string };

export async function ActionItemEventList({ actionId }: ActionItemEventListProps) {
  const events = await listActionEvents(actionId);

  if (events.length === 0) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400">No history yet.</p>
    );
  }

  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[320px] text-xs">
        <thead>
          <tr className="border-b border-zinc-600 text-left text-zinc-400">
            <th className="py-2 pr-3">Time</th>
            <th className="py-2 pr-3">Event</th>
            <th className="py-2 pr-3">Actor</th>
            <th className="py-2">Changes</th>
          </tr>
        </thead>
        <tbody className="text-zinc-500 dark:text-zinc-400">
          {events.map((e) => {
            const meta = (e.metadata ?? {}) as { delta?: Record<string, unknown>; source?: string };
            const delta = meta.delta as Record<string, { from?: unknown; to?: unknown }> | undefined;
            const deltaKeys = delta ? Object.keys(delta).join(", ") : "—";
            return (
              <tr key={e.id} className="border-b border-zinc-700/50">
                <td className="whitespace-nowrap py-2 pr-3">
                  {new Date(e.createdAt).toLocaleString()}
                </td>
                <td className="py-2 pr-3">{e.eventType}</td>
                <td className="py-2 pr-3">
                  {e.actorUserId ? e.actorUserId : "AI/System"}
                </td>
                <td className="py-2">{deltaKeys}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
