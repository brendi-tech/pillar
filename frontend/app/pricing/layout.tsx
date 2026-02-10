import { MarketingNavbar } from '@/components/MarketingPage/MarketingNavbar';
import { MarketingFooter } from '@/components/MarketingPage/MarketingFooter';

export default function PricingLayout({
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

      {/* Main content */}
      <main className="flex-1 max-w-marketingSection mx-auto border-x border-marketing w-full">
        {children}
      </main>

      <MarketingFooter />
    </div>
  );
}
