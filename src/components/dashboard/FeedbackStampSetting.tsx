"use client";

import { useState } from "react";
import { dashboardApi, errorMessage } from "@/lib/api/dashboard-client";
import { Card, SwitchRow } from "./ui";

/** The stamp card's feedback stamp: once per member, saved as soon as it's switched. */
export function FeedbackStampSetting({ venueId, initial }: { venueId: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function save(value: boolean) {
    setOn(value);
    setError(null);
    try {
      await dashboardApi.updateSettings(venueId, { stampPolicy: { feedbackStamp: value } });
    } catch (err) {
      setOn(!value);
      setError(errorMessage(err));
    }
  }

  return (
    <Card title="Feedback stamp">
      <SwitchRow
        title="Free stamp for feedback"
        description="A member's first feedback earns one stamp, once per member (joining after feedback counts). Later feedback is welcome but earns nothing, so stamps can't be collected from home."
        checked={on}
        onChange={save}
      />
      {error && <p className="field-error">{error}</p>}
    </Card>
  );
}
