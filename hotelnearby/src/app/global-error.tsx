"use client";

/**
 * Last-resort boundary. It replaces the root layout, so it renders its own
 * <html> and <body> and uses the approved light-only brand palette.
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <head>
        <style>{`
          body{margin:0;font-family:system-ui,sans-serif;background:#F5F2EB;color:#252C35}
          h1{color:#172B46}
          button{background:#172B46;color:#FFFFFF;border:0;border-radius:8px;padding:.7rem 1.1rem;font-weight:700;font-size:1rem;cursor:pointer}
          button:focus-visible{outline:3px solid #172B46;outline-offset:2px}
        `}</style>
      </head>
      <body>
        <main role="alert" style={{ maxWidth: "36rem", margin: "0 auto", padding: "6rem 1.5rem" }}>
          <h1>Something went wrong</h1>
          <p>The site hit an unexpected problem. Try again in a moment.</p>
          <button type="button" onClick={() => retry()}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
