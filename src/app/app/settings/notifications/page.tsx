import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { getNotificationSettings } from "./actions";
import { NotificationSettingsForm } from "./NotificationSettingsForm";

export default async function NotificationSettingsPage() {
  const settings = await getNotificationSettings();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification settings"
        subtitle="Slack and email preferences. Delivery not enabled yet."
      />

      {!settings ? (
        <Card className="p-5">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No organization selected. Use the switcher above.
          </p>
        </Card>
      ) : (
        <NotificationSettingsForm initial={settings} />
      )}
    </div>
  );
}
