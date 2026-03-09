"use client";

import { Card } from "@/components/ui/Card";

/**
 * Shown when no organization is selected. User must create one via the
 * Organization menu in the header (same as the Account section). They can
 * create an org for themselves and simply not add anyone else.
 */
export function CreateOrganizationCard() {
  return (
    <Card className="p-5 sm:p-6">
      <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
        Create an organization to get started
      </p>
      <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
        In the header, open the <strong>Organization</strong> menu (next to your account) and choose <strong>Create organization</strong>. You can create one for yourself and use it alone—no need to add anyone else.
      </p>
    </Card>
  );
}
