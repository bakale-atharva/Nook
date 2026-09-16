import Link from "next/link";
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <Link href="/" className="text-lg font-semibold">
        Nook
      </Link>
      <SignIn />
    </div>
  );
}
