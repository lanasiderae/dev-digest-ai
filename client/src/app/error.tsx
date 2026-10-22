"use client";

import { ErrorState } from "@devdigest/ui";

/** Root error boundary — catches any render-time exception not already
 *  handled by a query/mutation error state. Next.js requires this file to be
 *  a Client Component. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      fullScreen
      title="Something went wrong"
      body={error.message || "An unexpected error occurred."}
      onRetry={reset}
    />
  );
}
