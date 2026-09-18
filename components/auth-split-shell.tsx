import Link from "next/link";
import { Hash, MessageSquare, Shield, Zap } from "lucide-react";

const HIGHLIGHTS = [
  { icon: Hash, text: "Channels for every topic, public or private." },
  { icon: MessageSquare, text: "Real-time messaging with typing indicators." },
  { icon: Shield, text: "Role-based access, enforced by Clerk Organizations." },
  { icon: Zap, text: "Every organization is its own isolated workspace." },
];

export function AuthSplitShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="blueprint-grid scrollbar-hide flex h-dvh flex-col items-center justify-center overflow-y-auto bg-hero p-4 sm:p-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[calc(var(--radius-lg)+6px)] md:grid-cols-2">
        <div className="flex flex-col justify-center gap-8 p-8 text-hero-foreground sm:p-10">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-[5px] bg-hero-live font-mono text-xs font-bold text-hero-live-foreground">
              N
            </span>
            <span className="font-heading text-lg font-semibold">Nook</span>
          </Link>
          <div className="space-y-6">
            <h1 className="text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
              Team chat, drafted calmer.
            </h1>
            <ul className="space-y-3">
              {HIGHLIGHTS.map(({ icon: Icon, text }) => (
                <li
                  key={text}
                  className="flex items-start gap-3 text-sm text-hero-muted"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-[5px] border border-hero-border">
                    <Icon className="size-4" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex items-center justify-center rounded-[calc(var(--radius-lg)+4px)] bg-card p-8 shadow-sheet-lg sm:p-10 md:rounded-none md:rounded-r-[calc(var(--radius-lg)+6px)]">
          {children}
        </div>
      </div>
    </div>
  );
}
