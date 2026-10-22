import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Markdown renderer (replaces prototype mdLite). Inline + GFM, styled to
 *  read like a GitHub/VS Code README preview (headings, lists, blockquotes,
 *  tables, code blocks). */
export function Markdown({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <div className="dd-md" style={{ fontSize: "inherit", lineHeight: 1.55 }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1
              style={{
                fontSize: "1.7em",
                fontWeight: 650,
                color: "var(--text-primary)",
                margin: "24px 0 16px",
                paddingBottom: 8,
                borderBottom: "1px solid var(--border)",
              }}
            >
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2
              style={{
                fontSize: "1.35em",
                fontWeight: 650,
                color: "var(--text-primary)",
                margin: "22px 0 14px",
                paddingBottom: 6,
                borderBottom: "1px solid var(--border)",
              }}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3
              style={{ fontSize: "1.15em", fontWeight: 650, color: "var(--text-primary)", margin: "20px 0 10px" }}
            >
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 style={{ fontSize: "1em", fontWeight: 650, color: "var(--text-primary)", margin: "18px 0 8px" }}>
              {children}
            </h4>
          ),
          h5: ({ children }) => (
            <h5 style={{ fontSize: "0.9em", fontWeight: 650, color: "var(--text-primary)", margin: "16px 0 6px" }}>
              {children}
            </h5>
          ),
          h6: ({ children }) => (
            <h6 style={{ fontSize: "0.85em", fontWeight: 650, color: "var(--text-secondary)", margin: "16px 0 6px" }}>
              {children}
            </h6>
          ),
          p: ({ children }) => <p style={{ margin: "0 0 12px" }}>{children}</p>,
          strong: ({ children }) => (
            <strong style={{ fontWeight: 650, color: "var(--text-primary)" }}>{children}</strong>
          ),
          em: ({ children }) => <em style={{ fontStyle: "italic" }}>{children}</em>,
          del: ({ children }) => <del style={{ color: "var(--text-muted)" }}>{children}</del>,
          a: ({ children, href }) => (
            <a href={href} style={{ color: "var(--accent-text)", textDecoration: "underline" }}>
              {children}
            </a>
          ),
          ul: ({ children }) => <ul style={{ margin: "0 0 12px", paddingLeft: 24 }}>{children}</ul>,
          ol: ({ children }) => <ol style={{ margin: "0 0 12px", paddingLeft: 24 }}>{children}</ol>,
          li: ({ children }) => <li style={{ margin: "4px 0" }}>{children}</li>,
          blockquote: ({ children }) => (
            <blockquote
              style={{
                margin: "0 0 12px",
                padding: "0 14px",
                borderLeft: "3px solid var(--border-strong)",
                color: "var(--text-secondary)",
              }}
            >
              {children}
            </blockquote>
          ),
          hr: () => <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "20px 0" }} />,
          table: ({ children }) => (
            <div style={{ overflowX: "auto", marginBottom: 12 }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.92em" }}>{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th
              style={{
                border: "1px solid var(--border)",
                padding: "6px 10px",
                textAlign: "left",
                background: "var(--bg-hover)",
                fontWeight: 650,
                color: "var(--text-primary)",
              }}
            >
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td style={{ border: "1px solid var(--border)", padding: "6px 10px" }}>{children}</td>
          ),
          pre: ({ children }) => (
            <pre
              style={{
                margin: "0 0 12px",
                padding: "12px 14px",
                borderRadius: 6,
                background: "var(--code-bg)",
                overflowX: "auto",
                fontFamily: "var(--font-mono)",
                fontSize: "0.85em",
                lineHeight: 1.5,
              }}
            >
              {children}
            </pre>
          ),
          code: ({ children, className }) => {
            // Code spans never contain a newline (CommonMark); fenced code
            // blocks do — distinguishes "inline pill" vs. "block" styling
            // since react-markdown v9 no longer passes an `inline` prop.
            const isBlock = String(children).includes("\n");
            if (isBlock) {
              return (
                <code className={className} style={{ background: "none", padding: 0 }}>
                  {children}
                </code>
              );
            }
            return (
              <code
                className="mono"
                style={{
                  fontSize: "0.92em",
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: "var(--bg-hover)",
                  color: "var(--accent-text)",
                }}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
