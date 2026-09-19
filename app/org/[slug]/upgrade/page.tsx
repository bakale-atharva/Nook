import { auth } from "@clerk/nextjs/server";
import { PricingTable } from "@clerk/nextjs";

export default async function UpgradePage({ params }: PageProps<"/org/[slug]/upgrade">) {
  await auth.protect();
  const { slug } = await params;

  return (
    <div className="mx-auto flex max-w-3xl flex-1 flex-col gap-8 p-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Upgrade your organization</h1>
        <p className="text-muted-foreground">
          Unlock more members, unlimited channels, private channels, direct
          messages, and your full message history.
        </p>
      </div>
      <PricingTable for="organization" newSubscriptionRedirectUrl={`/org/${slug}`} />
    </div>
  );
}
