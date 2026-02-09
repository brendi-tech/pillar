import { MarketingNavbar } from '@/components/MarketingPage/MarketingNavbar';
import { MarketingFooter } from '@/components/MarketingPage/MarketingFooter';

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen flex flex-col bg-[#F3EFE8]"
      style={{
        backgroundImage: "url('/marketing/stripe-pattern.png')",
        backgroundRepeat: "repeat",
      }}
    >
      <MarketingNavbar />
      
      {/* Main content with grey sidebar borders */}
      <main className="flex-1 max-w-marketingSection mx-auto border-x border-marketing bg-white w-full">
        <div className="max-w-3xl mx-auto px-6 lg:px-8 py-16 sm:py-20">
          {children}
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
