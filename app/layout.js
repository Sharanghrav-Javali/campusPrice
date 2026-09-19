import "./globals.css";

export const metadata = {
  title: "CampusPrice — AI Deal Assistant for Students",
  description:
    "Paste any product, get an instant AI-powered price comparison and buy/wait verdict.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
