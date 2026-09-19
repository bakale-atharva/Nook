"use client";

import { useState } from "react";
import { useUpgradePrompt } from "@/components/upgrade-provider";
import { planLimitOf, toastConvexError } from "@/lib/convex-errors";

/**
 * Wraps an async action behind a submit button: tracks `submitting`, and turns
 * failures into the right UI. A plan limit opens the upgrade dialog (after
 * `onPlanLimit`, so a dialog can close itself first); anything else toasts
 * `fallback` or the server's message, unless `onError` handles it and returns
 * true (e.g. to show it inline on a field).
 */
export function useSubmitAction<Args extends unknown[], Result>(
  run: (...args: Args) => Promise<Result>,
  {
    onSuccess,
    onPlanLimit,
    onError,
    fallback,
  }: {
    onSuccess: (result: Result) => void;
    onPlanLimit?: () => void;
    onError?: (err: unknown) => boolean;
    fallback?: string;
  },
) {
  const promptUpgrade = useUpgradePrompt();
  const [submitting, setSubmitting] = useState(false);

  async function submit(...args: Args) {
    setSubmitting(true);
    try {
      onSuccess(await run(...args));
    } catch (err) {
      const limit = planLimitOf(err);
      if (limit) {
        onPlanLimit?.();
        promptUpgrade(limit);
      } else if (!onError?.(err)) {
        toastConvexError(err, fallback);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return { submit, submitting };
}
