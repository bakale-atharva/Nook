import { ChatPreviewMockup } from "@/components/chat-preview-mockup";
import { HeroActions } from "@/components/landing/hero-actions";
import { LandingHeader } from "@/components/landing/landing-header";
import { PricingPlans } from "@/components/landing/pricing-plans";
import { TAGLINE } from "@/lib/marketing-copy";

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

export default function LandingPage() {
  return (
    <div className="scrollbar-hide h-dvh overflow-y-auto bg-background">
      <div className="blueprint-grid relative bg-hero">
        <LandingHeader />

        <section className="relative mx-auto grid w-full max-w-6xl gap-16 px-6 pt-8 pb-32 sm:grid-cols-2 sm:items-center sm:px-10 sm:pt-12 sm:pb-40">
          <div className="flex flex-col gap-7">
            <h1 className="max-w-lg text-4xl font-semibold tracking-[-0.02em] text-hero-foreground sm:text-5xl">
              {TAGLINE}
            </h1>
            <p className="max-w-md text-lg text-hero-muted">
              Nook lays your organization out as a set of sheets, not a feed
              to keep up with. Real-time messaging, scoped per team, without
              Discord&apos;s noise or Slack&apos;s sprawl.
            </p>
            <HeroActions />
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
            <ul className="divide-y rounded-[calc(var(--radius-lg)+4px)] border">
              {SPEC_ROWS.map((row) => (
                <li
                  key={row.tag}
                  className="grid gap-2 px-6 py-6 sm:grid-cols-[9rem_1fr] sm:gap-8 sm:px-8"
                >
                  <span className="font-mono text-sm text-primary">{row.tag}</span>
                  <div>
                    <h3 className="font-medium">{row.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{row.description}</p>
                  </div>
                </li>
              ))}
            </ul>
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
            <PricingPlans />
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
