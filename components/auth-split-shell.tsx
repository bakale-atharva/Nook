import Link from "next/link";
import { Hash, MessageSquare, Shield, Zap } from "lucide-react";
import { ChatPreviewMockup } from "@/components/chat-preview-mockup";

const HIGHLIGHTS = [
  { icon: Hash, text: "Channels for every topic, public or private." },
  { icon: MessageSquare, text: "Real-time messaging with typing indicators." },
  { icon: Shield, text: "Role-based access, enforced by Clerk Organizations." },
  { icon: Zap, text: "Every organization is its own isolated workspace." },
];

export function AuthSplitShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="hero-gradient scrollbar-hide flex h-dvh flex-col overflow-y-auto p-3 sm:p-6">
      <div className="relative mx-auto grid w-full max-w-5xl flex-1 overflow-hidden rounded-[2rem] border bg-card shadow-xl md:grid-cols-2">
        <div className="flex flex-col justify-between gap-8 p-8 sm:p-10">
          <Link href="/" className="font-heading text-lg font-semibold">
            Nook
          </Link>
          <div className="space-y-6">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Team chat for organizations that mean business.
            </h1>
            <ul className="space-y-3">
              {HIGHLIGHTS.map(({ icon: Icon, text }) => (
                <li
                  key={text}
                  className="flex items-start gap-3 text-sm text-muted-foreground"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border bg-muted">
                    <Icon className="size-4" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <ChatPreviewMockup className="hidden sm:block" />
        </div>
        <div className="flex items-stretch justify-center border-t p-8 sm:border-t-0 sm:border-l">
          {children}
        </div>
      </div>
    </div>
  );
}
