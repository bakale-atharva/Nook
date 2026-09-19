import { SignIn } from "@clerk/nextjs";
import { AuthSplitShell, authAppearance } from "@/components/auth-split-shell";

export default function SignInPage() {
  return (
    <AuthSplitShell>
      <SignIn appearance={authAppearance} />
    </AuthSplitShell>
  );
}
