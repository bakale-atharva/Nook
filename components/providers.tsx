"use client";

import { useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is not set.");
}

const convex = new ConvexReactClient(convexUrl);

/**
 * Everything the signed-in workspace needs and the marketing and auth pages
 * don't: the Convex client wired to Clerk, tooltips, and toasts. Mounted by
 * the /org layout only, so `convex/react` stays out of the other routes.
 */
export function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <TooltipProvider>
        {children}
        <Toaster />
      </TooltipProvider>
    </ConvexProviderWithClerk>
  );
}
