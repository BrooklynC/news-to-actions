import { prisma } from "@/lib/db";

type ActionItemAuditProps = {
  actionItemId: string;
  organizationId: string;
};

export async function ActionItemAudit({
  actionItemId,
  organizationId,
}: ActionItemAuditProps) {
  const item = await prisma.actionItem.findFirst({
    where: { id: actionItemId, organizationId },
    select: { id: true },
  });
  if (!item) return null;

  const audits = await prisma.actionItemAudit.findMany({
    where: { actionItemId },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { actorUser: { select: { email: true } } },
  });

  if (audits.length === 0) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400">No changes yet.</p>
    );
  }

  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[320px] text-xs">
        <thead>
          <tr className="border-b border-zinc-600 text-left text-zinc-400">
            <th className="py-2 pr-3">Timestamp</th>
            <th className="py-2 pr-3">Actor</th>
            <th className="py-2 pr-3">Field</th>
            <th className="py-2">Change</th>
          </tr>
        </thead>
        <tbody className="text-zinc-500 dark:text-zinc-400">
          {audits.map((a) => (
            <tr key={a.id} className="border-b border-zinc-700/50">
              <td className="py-2 pr-3 whitespace-nowrap">
                {new Date(a.createdAt).toLocaleString()}
              </td>
              <td className="py-2 pr-3">
                {a.actorUser?.email ?? "system"}
              </td>
              <td className="py-2 pr-3">{a.field}</td>
              <td className="py-2">
                <span className="text-zinc-600 dark:text-zinc-500">
                  {a.oldValue ?? "—"}
                </span>
                {" → "}
                <span className="text-zinc-300 dark:text-zinc-300">
                  {a.newValue ?? "—"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
