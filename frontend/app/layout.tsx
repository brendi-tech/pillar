import { AdminProviders } from "@/components/AdminProviders";
import { Agentation } from "@/components/DevTools/Agentation";
import {
  getPathname,
  isAdminRequest,
  isMarketingRequest,
} from "@/lib/api-client";
import { PostHogMarketingProvider } from "@/providers/PostHogProvider";
import { GoogleAnalytics } from "@next/third-parties/google";
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Instrument_Serif, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// Suisse Intl - clean Swiss sans-serif for body text
const suisseIntl = localFont({
  src: [
    { path: "./fonts/SuisseIntl-Light.otf", weight: "300", style: "normal" },
    { path: "./fonts/SuisseIntl-Book.otf", weight: "350", style: "normal" },
    { path: "./fonts/SuisseIntl-Regular.otf", weight: "400", style: "normal" },
    { path: "./fonts/SuisseIntl-Medium.otf", weight: "500", style: "normal" },
    { path: "./fonts/SuisseIntl-SemiBold.otf", weight: "600", style: "normal" },
    { path: "./fonts/SuisseIntl-Bold.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-suisse-intl",
  display: "swap",
});

// Beautiful serif for headings - adds warmth and distinction
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
});

// Editorial Today - display serif for marketing
const editorialToday = localFont({
  src: [
    {
      path: "./fonts/EditorialToday-Thin.woff2",
      weight: "100",
      style: "normal",
    },
    {
      path: "./fonts/EditorialToday-ThinItalic.woff2",
      weight: "100",
      style: "italic",
    },
    {
      path: "./fonts/EditorialToday-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/EditorialToday-Italic.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "./fonts/EditorialToday-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "./fonts/EditorialToday-Bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/EditorialToday-BoldItalic.woff2",
      weight: "700",
      style: "italic",
    },
    {
      path: "./fonts/EditorialToday-ExtraBold.woff2",
      weight: "800",
      style: "normal",
    },
    {
      path: "./fonts/EditorialToday-ExtBdIta.woff2",
      weight: "800",
      style: "italic",
    },
  ],
  variable: "--font-editorial-today",
  display: "swap",
});

// Monospace for code
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const isAdmin = await isAdminRequest();
  const isMarketing = await isMarketingRequest();

  const baseMetadata = {
    metadataBase: new URL("https://trypillar.com"),
  };

  // Admin subdomain
  if (isAdmin) {
    return {
      ...baseMetadata,
      title: "Pillar Admin",
      description: "Manage your AI product copilot with Pillar.",
    };
  }

  // Marketing (root domain)
  if (isMarketing) {
    return {
      ...baseMetadata,
      title: "Pillar - Your App's Copilot",
      description:
        "Pillar is an open source copilot that turns user and agent requests into completed actions, right inside your app.",
      robots: "index, follow, max-snippet:-1, max-image-preview:large",
    };
  }

  // Default
  return {
    ...baseMetadata,
    title: "Pillar - Your App's Copilot",
    description:
      "Pillar is an open source copilot that turns user and agent requests into completed actions, right inside your app.",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isAdmin = await isAdminRequest();
  const isMarketing = await isMarketingRequest();

  const bodyClasses = `${suisseIntl.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} ${editorialToday.variable} font-sans antialiased`;
  const bodyStyle = {
    fontFamily: "var(--font-suisse-intl), system-ui, sans-serif",
  };

  // ADMIN SUBDOMAIN (admin.localhost, admin.trypillar.com, etc.)
  // Renders auth pages and admin dashboard
  // Wraps in AdminProviders for auth context (needed by /login, /signup, /logout)
  if (isAdmin) {
    return (
      <html lang="en" suppressHydrationWarning>
        <head>
          <link rel="icon" href="/favicon.ico" sizes="32x32" />
        </head>
        <GoogleAnalytics gaId="G-VRNTGFMQMR" />
        <body className={bodyClasses} style={bodyStyle}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <AdminProviders>{children}</AdminProviders>
            <Agentation />
          </ThemeProvider>
          <Agentation />
        </body>
      </html>
    );
  }

  // MARKETING (root domain: localhost, trypillar.com, etc.)
  // Renders marketing pages (/, /assistant, etc.) via internal /marketing route
  if (isMarketing) {
    const pathname = await getPathname();
    const isHelpRoute = pathname.startsWith("/help");

    // Help routes on marketing domain render like normal pages
    if (isHelpRoute) {
      return (
        <html lang="en" suppressHydrationWarning>
          <head>
            <link rel="icon" href="/favicon.ico" sizes="32x32" />
            <link
              rel="alternate"
              type="application/rss+xml"
              title="Pillar Blog"
              href="https://trypillar.com/blog/feed.xml"
            />
          </head>
          <GoogleAnalytics gaId="G-VRNTGFMQMR" />
          <body className={bodyClasses} style={bodyStyle}>
            <PostHogMarketingProvider>
              <ThemeProvider
                attribute="class"
                defaultTheme="dark"
                enableSystem={false}
                disableTransitionOnChange
              >
                {children}
              </ThemeProvider>
            </PostHogMarketingProvider>
            {/* <Agentation /> */}
          </body>
        </html>
      );
    }

    // All other marketing routes show the landing page
    return (
      <html lang="en" suppressHydrationWarning>
        <head>
          <link rel="icon" href="/favicon.ico" sizes="32x32" />
          <link
            rel="alternate"
            type="application/rss+xml"
            title="Pillar Blog"
            href="https://trypillar.com/blog/feed.xml"
          />
        </head>
        <GoogleAnalytics gaId="G-VRNTGFMQMR" />
        <body className={bodyClasses} style={bodyStyle}>
          <PostHogMarketingProvider>
            {children}
          </PostHogMarketingProvider>
          <Agentation />
        </body>
      </html>
    );
  }

  // FALLBACK - Unknown subdomain, show 404
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
      </head>
      <GoogleAnalytics gaId="G-VRNTGFMQMR" />
      <body className={bodyClasses} style={bodyStyle}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                Not Found
              </h1>
              <p className="mt-4 text-gray-600 dark:text-gray-400">
                The page you&apos;re looking for doesn&apos;t exist.
              </p>
            </div>
          </div>
        </ThemeProvider>
        <Agentation />
      </body>
    </html>
  );
}
