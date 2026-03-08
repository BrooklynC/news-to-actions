import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  getOrgIngestCadence,
  getOrgActionItemsPerPersona,
  updateOrgIngestCadence,
  updateOrgActionItemsPerPersona,
} from "./actions";
import { CadenceForm } from "./CadenceForm";
import { ActionItemsPerPersonaForm } from "./ActionItemsPerPersonaForm";
import { getNotificationSettings } from "./notifications/actions";
import { NotificationSettingsForm } from "./notifications/NotificationSettingsForm";

export default async function SettingsPage() {
  const [cadenceData, actionItemsData, notificationSettings] = await Promise.all([
    getOrgIngestCadence(),
    getOrgActionItemsPerPersona(),
    getNotificationSettings(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Organization-wide preferences."
      />

      <Card className="p-5 sm:p-6">
        <ThemeToggle />
      </Card>

      {!cadenceData ? (
        <Card className="p-5">
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Select an organization above to change settings.
          </p>
        </Card>
      ) : (
        <Card className="p-5 sm:p-6 space-y-6">
          <div>
            <h2 className="mb-3 text-base font-medium text-stone-900 dark:text-stone-100">
              Refresh cadence
            </h2>
            <CadenceForm
              initialCadence={cadenceData.ingestCadence}
              formAction={updateOrgIngestCadence}
            />
          </div>
          {actionItemsData && (
            <div className="border-t border-stone-200 pt-6 dark:border-stone-700">
              <h2 className="mb-3 text-base font-medium text-stone-900 dark:text-stone-100">
                Action items per persona per article
              </h2>
              <ActionItemsPerPersonaForm
                initialValue={actionItemsData.actionItemsPerPersonaPerArticle}
                formAction={updateOrgActionItemsPerPersona}
              />
            </div>
          )}
        </Card>
      )}

      {notificationSettings && (
        <Card className="p-5 sm:p-6">
          <h2 className="mb-3 text-base font-medium text-stone-900 dark:text-stone-100">
            Notifications
          </h2>
          <p className="mb-4 text-sm text-stone-600 dark:text-stone-400">
            Slack and email. Delivery is not enabled yet.
          </p>
          <NotificationSettingsForm initial={notificationSettings} />
        </Card>
      )}
    </div>
  );
}
