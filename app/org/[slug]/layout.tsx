import { auth } from "@clerk/nextjs/server";
import { ConvexClientProvider } from "@/components/providers";
import { WorkspaceShell } from "@/components/workspace-shell";

export default async function WorkspaceLayout({ children, params }: LayoutProps<"/org/[slug]">) {
  // Signed-out visitors go to sign-in. This lives here (and in the pages
  // below) rather than in proxy.ts, so protection follows the resource and
  // not a path pattern.
  await auth.protect();
  const { slug } = await params;

  return (
    <ConvexClientProvider>
      <WorkspaceShell slug={slug}>{children}</WorkspaceShell>
    </ConvexClientProvider>
  );
}
