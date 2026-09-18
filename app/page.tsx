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
import { ChatPreviewMockup } from "@/components/chat-preview-mockup";
import { Hash, MessageSquare, Shield, Zap } from "lucide-react";

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

function LandingHeader() {
  const { organization } = useOrganization();

  return (
    <header className="flex items-center justify-between px-6 py-4">
      <span className="font-heading text-lg font-semibold">Nook</span>
      <div className="flex items-center gap-3">
        <Show when="signed-out">
          <SignInButton>
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </SignInButton>
          <SignUpButton>
            <Button variant="cta" size="sm">
              Get started
            </Button>
          </SignUpButton>
        </Show>
        <Show when="signed-in">
          <Button
            size="sm"
            nativeButton={false}
            render={<Link href={organization ? `/org/${organization.slug}` : "/onboarding"} />}
          >
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
    <div className="scrollbar-hide flex h-dvh flex-col overflow-y-auto bg-background">
      <div className="hero-gradient px-3 pt-3 sm:px-6 sm:pt-6">
        <div className="relative mx-auto flex w-full max-w-6xl flex-col rounded-[2rem] border bg-card shadow-xl">
          <LandingHeader />

          <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 pt-12 pb-28 text-center sm:pt-16 sm:pb-36">
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
                  <Button variant="cta" size="lg">
                    Get started free
                  </Button>
                </SignUpButton>
                <SignInButton>
                  <Button size="lg" variant="outline">
                    Sign in
                  </Button>
                </SignInButton>
              </Show>
            </div>
          </section>

          <ChatPreviewMockup className="absolute -bottom-14 left-1/2 hidden w-[min(90%,640px)] -translate-x-1/2 sm:-bottom-20 sm:block" />
        </div>
      </div>

      <div className="h-14 sm:h-24" />

      <main className="flex-1">
        <section className="px-6 py-16">
          <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="flex gap-4 rounded-2xl border bg-card p-5"
              >
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
            <Show when="signed-in">
              <PricingTable for="organization" />
            </Show>
            <Show when="signed-out">
              <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
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
