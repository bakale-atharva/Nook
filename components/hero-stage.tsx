/** The full-height blueprint backdrop the sign-in, sign-up and onboarding cards sit on. */
export function HeroStage({ children }: { children: React.ReactNode }) {
  return (
    <div className="blueprint-grid scrollbar-hide flex h-dvh flex-col items-center justify-center overflow-y-auto bg-hero p-4 sm:p-8">
      {children}
    </div>
  );
}
