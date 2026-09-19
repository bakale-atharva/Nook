"use client";

import { PricingTable } from "@clerk/nextjs";
import { useParams } from "next/navigation";

export default function UpgradePage() {
  const params = useParams<{ slug: string }>();

  return (
    <div className="mx-auto flex max-w-3xl flex-1 flex-col gap-8 p-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Upgrade your organization</h1>
        <p className="text-muted-foreground">
          Unlock more members, unlimited channels, private channels, direct
          messages, and your full message history.
        </p>
      </div>
      <PricingTable for="organization" newSubscriptionRedirectUrl={`/org/${params.slug}`} />
    </div>
  );
}
