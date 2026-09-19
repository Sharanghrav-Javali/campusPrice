import "./globals.css";

export const metadata = {
  title: "CampusPrice — AI Shopping Research & Recommendation Platform",
  description:
    "Describe what you need in plain English. CampusPrice extracts your requirements, researches live market deals across Indian retailers, and recommends the best matching products.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
