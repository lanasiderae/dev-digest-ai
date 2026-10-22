"use client";

/** Catches errors in the root layout itself (e.g. next-intl/theme setup
 *  failing) — must render its own <html>/<body> and can't rely on anything
 *  the root layout would normally provide (styles, providers, locale). */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#111", color: "#eee" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            textAlign: "center",
            padding: 24,
          }}
        >
          <h2 style={{ margin: 0 }}>Something went wrong</h2>
          <p style={{ margin: 0, color: "#999", maxWidth: 420 }}>{error.message || "An unexpected error occurred."}</p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: 8,
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid #444",
              background: "#222",
              color: "#eee",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
