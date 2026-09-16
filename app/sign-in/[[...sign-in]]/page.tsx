import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { MarketingShell } from "@/components/marketing-shell";

export default function SignInPage() {
  return (
    <MarketingShell className="items-center justify-center gap-6 px-6 py-16">
      <Link href="/" className="font-heading text-lg font-semibold">
        Nook
      </Link>
      <SignIn />
    </MarketingShell>
  );
}
