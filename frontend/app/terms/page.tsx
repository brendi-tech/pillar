import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PillarLogoWithName } from "@/components/marketing/LandingPage/PillarLogoWithName";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { getLegalDocument } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: "Terms of Service | Pillar",
  description: "Terms of Service for Pillar - Your App's Copilot",
};

export default function TermsPage() {
  const doc = getLegalDocument("terms");

  if (!doc) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/" className="inline-block">
            <PillarLogoWithName className="h-8" />
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        <article>
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {doc.frontmatter.title}
            </h1>
            <p className="text-muted-foreground">
              Last Updated: {doc.frontmatter.lastUpdated}
            </p>
          </header>
          <div className="prose dark:prose-invert max-w-none">
            <MarkdownRenderer content={doc.content} />
          </div>
        </article>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 mt-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} Pillar. All rights reserved.</p>
            <div className="flex gap-6">
              <Link href="/privacy" className="hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
