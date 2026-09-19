"use client";

import { Show, SignInButton, SignUpButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

/** The hero's calls to action, for visitors who aren't signed in. */
export function HeroActions() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Show when="signed-out">
        <SignUpButton>
          <Button variant="cta" size="lg">
            Start free
          </Button>
        </SignUpButton>
        <SignInButton>
          <Button size="lg" variant="hero-outline">
            Sign in
          </Button>
        </SignInButton>
      </Show>
    </div>
  );
}
