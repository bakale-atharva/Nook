"use client";

import { PricingTable } from "@clerk/nextjs";
import { useParams } from "next/navigation";
import { Check } from "lucide-react";

const FREE_FEATURES = [
  "Up to 5 members",
  "Up to 5 channels",
  "Last 30 messages per channel",
  "Real-time messaging & typing",
];

const PRO_FEATURES = [
  "Up to 20 members",
  "Unlimited channels",
  "Full message history",
  "Private channels",
];

function PlanList({ title, features }: { title: string; features: string[] }) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-2 font-medium">{title}</h3>
      <ul className="space-y-1.5 text-sm text-muted-foreground">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2">
            <Check className="size-4 shrink-0 text-primary" />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function UpgradePage() {
  const params = useParams<{ slug: string }>();

  return (
    <div className="mx-auto flex max-w-3xl flex-1 flex-col gap-8 p-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Upgrade your organization</h1>
        <p className="text-muted-foreground">
          Unlock more members, unlimited channels, private channels, and
          your full message history.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <PlanList title="Free" features={FREE_FEATURES} />
        <PlanList title="Pro" features={PRO_FEATURES} />
      </div>
      <PricingTable for="organization" newSubscriptionRedirectUrl={`/org/${params.slug}`} />
    </div>
  );
}
