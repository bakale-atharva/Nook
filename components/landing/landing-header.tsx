"use client";

import Link from "next/link";
import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
  useOrganization,
} from "@clerk/nextjs";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

/** Where "Go to workspace" leads: the active org, or onboarding to pick or create one. */
function GoToWorkspaceButton() {
  const { organization, isLoaded } = useOrganization();
  // Wait for Clerk so the link doesn't point at /onboarding and then change.
  if (!isLoaded) return null;
  return (
    <Button
      size="sm"
      variant="cta"
      nativeButton={false}
      render={<Link href={organization ? `/org/${organization.slug}` : "/onboarding"} />}
    >
      Go to workspace
    </Button>
  );
}

export function LandingHeader() {
  return (
    <header className="flex items-center justify-between px-6 py-5 sm:px-10">
      <BrandMark className="text-hero-foreground" />
      <div className="flex items-center gap-3">
        <Show when="signed-out">
          <SignInButton>
            <Button variant="hero-ghost" size="sm">
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
          <GoToWorkspaceButton />
          <UserButton />
        </Show>
      </div>
    </header>
  );
}
