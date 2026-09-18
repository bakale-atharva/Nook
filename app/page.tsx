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
import { cn } from "@/lib/utils";

const SPEC_ROWS = [
  {
    tag: "#channels",
    title: "One sheet per conversation",
    description:
      "Channels are sheets in your organization's set — create them for a team, a project, or a topic, and archive them when the work is done.",
  },
  {
    tag: "#realtime",
    title: "Nothing to refresh",
    description:
      "Messages, edits, and typing state sync the moment they happen, powered by Convex's reactive backend.",
  },
  {
    tag: "#access",
    title: "Scoped to the room",
    description:
      "Admins and members get exactly the permissions they need, enforced by Clerk Organizations on every request.",
  },
  {
    tag: "#workspace",
    title: "One org, one plan",
    description:
      "Every organization is its own isolated workspace, with its own members, channels, and billing — never mixed with another team's.",
  },
];

function LandingHeader() {
  const { organization } = useOrganization();

  return (
    <header className="flex items-center justify-between px-6 py-5 sm:px-10">
      <div className="flex items-center gap-2.5">
        <span className="flex size-7 items-center justify-center rounded-[5px] bg-hero-live font-mono text-xs font-bold text-hero-live-foreground">
          N
        </span>
        <span className="font-heading text-lg font-semibold text-hero-foreground">
          Nook
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Show when="signed-out">
          <SignInButton>
            <Button
              variant="ghost"
              size="sm"
              className="text-hero-foreground hover:bg-white/10 hover:text-hero-foreground"
            >
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
            variant="cta"
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
    <div className="scrollbar-hide h-dvh overflow-y-auto bg-background">
      <div className="blueprint-grid relative bg-hero">
        <LandingHeader />

        <section className="relative mx-auto grid w-full max-w-6xl gap-16 px-6 pt-8 pb-32 sm:grid-cols-2 sm:items-center sm:px-10 sm:pt-12 sm:pb-40">
          <div className="flex flex-col gap-7">
            <h1 className="max-w-lg text-4xl font-semibold tracking-[-0.02em] text-hero-foreground sm:text-5xl">
              Team chat, drafted calmer.
            </h1>
            <p className="max-w-md text-lg text-hero-muted">
              Nook lays your organization out as a set of sheets, not a feed
              to keep up with. Real-time messaging, scoped per team, without
              Discord&apos;s noise or Slack&apos;s sprawl.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Show when="signed-out">
                <SignUpButton>
                  <Button variant="cta" size="lg">
                    Start free
                  </Button>
                </SignUpButton>
                <SignInButton>
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-hero-border bg-transparent text-hero-foreground hover:bg-white/10 hover:text-hero-foreground"
                  >
                    Sign in
                  </Button>
                </SignInButton>
              </Show>
            </div>
          </div>

          <ChatPreviewMockup className="mx-auto h-64 w-full max-w-sm sm:h-72" />
        </section>
      </div>

      <main>
        <section className="border-b px-6 py-20 sm:px-10">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-10 text-2xl font-semibold">
              What&apos;s on the sheet
            </h2>
            <div className="rounded-[calc(var(--radius-lg)+4px)] border">
              {SPEC_ROWS.map((row, i) => (
                <div
                  key={row.tag}
                  className={cn(
                    "grid gap-2 px-6 py-6 sm:grid-cols-[9rem_1fr] sm:gap-8 sm:px-8",
                    i !== 0 && "border-t"
                  )}
                >
                  <span className="font-mono text-sm text-primary">
                    {row.tag}
                  </span>
                  <div>
                    <h3 className="font-medium">{row.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {row.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="px-6 py-20 sm:px-10">
          <div className="mx-auto max-w-3xl">
            <div className="mb-10">
              <h2 className="text-2xl font-semibold">
                Simple, org-based pricing
              </h2>
              <p className="mt-1 text-muted-foreground">
                Every organization gets its own plan. Start free, upgrade
                when you outgrow it.
              </p>
            </div>
            <Show when="signed-in">
              <PricingTable for="organization" />
            </Show>
            <Show when="signed-out">
              <div className="rounded-[calc(var(--radius-lg)+4px)] border border-dashed p-6 text-center text-sm text-muted-foreground">
                Sign up and create an organization to see live pricing and
                upgrade options.
              </div>
            </Show>
          </div>
        </section>
      </main>

      <footer className="title-block border-t px-6 py-5 sm:px-10">
        <span>Nook</span>
        <span className="ml-auto">Team workspace chat</span>
      </footer>
    </div>
  );
}
