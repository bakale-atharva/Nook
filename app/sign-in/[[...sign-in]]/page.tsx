import { SignIn } from "@clerk/nextjs";
import { AuthSplitShell } from "@/components/auth-split-shell";

export default function SignInPage() {
  return (
    <AuthSplitShell>
      <SignIn
        appearance={{
          elements: {
            rootBox: "w-full h-full",
            cardBox: "w-full h-full flex flex-col justify-center",
          },
        }}
      />
    </AuthSplitShell>
  );
}
