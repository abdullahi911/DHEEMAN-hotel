import "./globals.css";

export const metadata = {
  title: "Dheeman Management",
  description: "Restaurant management dashboard for Dheeman.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
