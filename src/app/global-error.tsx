"use client";

// Last-resort boundary for errors in the root layout itself (e.g. Providers).
// It replaces the whole document, so it can't rely on globals.css or the UI kit.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="tr">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600 }}>Uygulama yüklenemedi</h1>
          <p style={{ fontSize: 14, color: "#666" }}>Beklenmeyen bir hata oluştu.</p>
          <button onClick={reset} style={{ marginTop: 12, padding: "8px 16px", cursor: "pointer" }}>
            Tekrar Dene
          </button>
        </div>
      </body>
    </html>
  );
}
