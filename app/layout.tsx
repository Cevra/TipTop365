// Root passthrough. The real <html>/<body>, fonts and providers live in
// app/[locale]/layout.tsx so the lang attribute carries the active locale
// (next-intl App Router pattern, plan D9).
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
