"use client";

import { PricingTable, Show } from "@clerk/nextjs";

/** Live plans for signed-in people, a nudge to sign up for everyone else. */
export function PricingPlans() {
  return (
    <>
      <Show when="signed-in">
        <PricingTable for="organization" />
      </Show>
      <Show when="signed-out">
        <div className="rounded-[calc(var(--radius-lg)+4px)] border border-dashed p-6 text-center text-sm text-muted-foreground">
          Sign up and create an organization to see live pricing and upgrade options.
        </div>
      </Show>
    </>
  );
}
