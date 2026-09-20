import { auth } from "@clerk/nextjs/server";
import { WorkspaceHome } from "@/components/workspace-home";

export default async function WorkspaceHomePage() {
  await auth.protect();
  return <WorkspaceHome />;
}
