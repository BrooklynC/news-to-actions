"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { upsertNotificationSettingsFormData } from "./actions";
import type { NotificationSettingsData } from "./actions";

type Props = {
  initial: NotificationSettingsData;
};

export function NotificationSettingsForm({ initial }: Props) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    const result = await upsertNotificationSettingsFormData(formData);
    if (result.success) {
      setSaved(true);
    } else {
      setError(result.error ?? "Couldn’t save. Check your entries and try again.");
    }
  }

  const recipientsText = initial.emailRecipients.join("\n");

  return (
    <form action={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}
      {saved && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-200">
          Settings saved
        </div>
      )}

      <Card className="space-y-4 p-5 sm:p-6">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Slack
        </h3>
        <div>
          <label
            htmlFor="slackWebhookUrl"
            className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400"
          >
            Webhook URL
          </label>
          <input
            id="slackWebhookUrl"
            name="slackWebhookUrl"
            type="url"
            placeholder="https://hooks.slack.com/services/..."
            defaultValue={initial.slackWebhookUrl ?? ""}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div>
          <label
            htmlFor="slackChannel"
            className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400"
          >
            Channel label (optional)
          </label>
          <input
            id="slackChannel"
            name="slackChannel"
            type="text"
            placeholder="#general"
            maxLength={80}
            defaultValue={initial.slackChannel ?? ""}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Delivery is not enabled yet; these settings are saved for when it is.
        </p>
      </Card>

      <Card className="space-y-4 p-5 sm:p-6">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Email digest
        </h3>
        <div>
          <label
            htmlFor="emailRecipients"
            className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400"
          >
            Recipients (one email per line or comma-separated)
          </label>
          <textarea
            id="emailRecipients"
            name="emailRecipients"
            rows={3}
            placeholder="you@example.com"
            defaultValue={recipientsText}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div>
          <label
            htmlFor="digestCadence"
            className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400"
          >
            Digest cadence
          </label>
          <select
            id="digestCadence"
            name="digestCadence"
            defaultValue={initial.digestCadence}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="OFF">Off</option>
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
          </select>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Delivery is not enabled yet; preferences are saved for when it is.
        </p>
      </Card>

      <button
        type="submit"
        className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Save settings
      </button>
    </form>
  );
}
