import { clerkMiddleware } from "@clerk/nextjs/server";

// Route protection is not done here: `createRouteMatcher` path patterns can
// drift from how Next.js actually routes a request, so each protected layout
// and page calls `auth.protect()` itself (see app/org/[slug]/layout.tsx).
// This only keeps Clerk's session available and syncs the active organization.
export default clerkMiddleware({
  // Visiting /org/<org-slug>/... makes that Organization the active one, so
  // the session token (and therefore Convex) is always scoped to the URL.
  organizationSyncOptions: {
    organizationPatterns: ["/org/:slug", "/org/:slug/(.*)"],
  },
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
