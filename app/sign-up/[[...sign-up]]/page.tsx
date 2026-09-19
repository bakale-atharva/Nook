import { SignUp } from "@clerk/nextjs";
import { AuthSplitShell, authAppearance } from "@/components/auth-split-shell";

export default function SignUpPage() {
  return (
    <AuthSplitShell>
      <SignUp appearance={authAppearance} />
    </AuthSplitShell>
  );
}
