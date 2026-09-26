import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.5rem",
        fontFamily: "sans-serif",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <h1 style={{ fontSize: "2rem", margin: 0 }}>Fun Bakery</h1>
      <p style={{ margin: 0, color: "#555" }}>
        ระบบสั่งอาหารร้านบุฟเฟต์ — ทดสอบการ deploy สำเร็จ
      </p>
      <nav style={{ display: "flex", gap: "1rem" }}>
        <Link
          href="/generate-qr"
          style={{
            padding: "0.6rem 1.2rem",
            borderRadius: "8px",
            background: "#111",
            color: "#fff",
            textDecoration: "none",
          }}
        >
          ไปหน้า Generate QR
        </Link>
        <Link
          href="/kitchen"
          style={{
            padding: "0.6rem 1.2rem",
            borderRadius: "8px",
            border: "1px solid #111",
            color: "#111",
            textDecoration: "none",
          }}
        >
          ไปหน้า Kitchen
        </Link>
      </nav>
    </main>
  );
}
