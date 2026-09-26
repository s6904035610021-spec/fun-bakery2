export const metadata = {
  title: "Fun Bakery",
  description: "ระบบสั่งอาหารร้านบุฟเฟต์ Fun Bakery",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
