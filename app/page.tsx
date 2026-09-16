"use client";

import Link from "next/link";
import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
  PricingTable,
  useOrganization,
} from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Check, Hash, MessageSquare, Shield, Zap } from "lucide-react";

const FEATURES = [
  {
    icon: Hash,
    title: "Channels for every topic",
    description:
      "Organize conversations by team, project, or topic. Admins create and manage channels; everyone can join public ones.",
  },
  {
    icon: MessageSquare,
    title: "Real-time messaging",
    description:
      "Messages, edits, and typing indicators sync instantly across your team, powered by Convex's reactive backend.",
  },
  {
    icon: Shield,
    title: "Role-based access",
    description:
      "Admins and members get exactly the permissions they need, enforced by Clerk Organizations on every request.",
  },
  {
    icon: Zap,
    title: "Built for teams, not individuals",
    description:
      "Every organization is its own isolated workspace with its own members, channels, and billing.",
  },
];

const FREE_FEATURES = [
  "Up to 5 members",
  "Up to 5 channels",
  "Last 30 messages per channel",
];

const PRO_FEATURES = [
  "Up to 20 members",
  "Unlimited channels",
  "Full message history",
  "Private channels",
];

function LandingHeader() {
  const { organization } = useOrganization();

  return (
    <header className="flex items-center justify-between px-6 py-4">
      <span className="text-lg font-semibold">Nook</span>
      <div className="flex items-center gap-3">
        <Show when="signed-out">
          <SignInButton>
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </SignInButton>
          <SignUpButton>
            <Button size="sm">Get started</Button>
          </SignUpButton>
        </Show>
        <Show when="signed-in">
          <Button size="sm" render={<Link href={organization ? `/org/${organization.slug}` : "/onboarding"} />}>
            Go to workspace
          </Button>
          <UserButton />
        </Show>
      </div>
    </header>
  );
}

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <LandingHeader />

      <main className="flex-1">
        <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-20 text-center sm:py-28">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Team chat for organizations that mean business.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Nook is real-time, organization-scoped messaging: channels,
            roles, and billing all managed per team — no personal accounts,
            no confusion about who&apos;s in the room.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Show when="signed-out">
              <SignUpButton>
                <Button size="lg">Get started free</Button>
              </SignUpButton>
              <SignInButton>
                <Button size="lg" variant="outline">
                  Sign in
                </Button>
              </SignInButton>
            </Show>
          </div>
        </section>

        <section className="border-t px-6 py-16">
          <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted">
                  <Icon className="size-5" />
                </div>
                <div>
                  <h3 className="font-medium">{title}</h3>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="border-t px-6 py-16">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-semibold">Simple, org-based pricing</h2>
              <p className="text-muted-foreground">
                Every organization gets its own plan. Start free, upgrade when you outgrow it.
              </p>
            </div>
            <div className="mb-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border p-4">
                <h3 className="mb-2 font-medium">Free</h3>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {FREE_FEATURES.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="size-4 shrink-0 text-primary" /> {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border p-4">
                <h3 className="mb-2 font-medium">Pro</h3>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {PRO_FEATURES.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="size-4 shrink-0 text-primary" /> {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <Show when="signed-in">
              <PricingTable for="organization" />
            </Show>
            <Show when="signed-out">
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Sign up and create an organization to see live pricing and
                upgrade options.
              </div>
            </Show>
          </div>
        </section>
      </main>

      <footer className="border-t px-6 py-6 text-center text-sm text-muted-foreground">
        Nook — a B2B organization chat app.
      </footer>
    </div>
  );
}
