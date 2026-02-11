/**
 * TechnicalPromptHeader — Static React component showing the user's
 * quoted request at the top of the technical showcase.
 *
 * Mirrors the visual style of the Remotion PromptHeader but uses
 * Tailwind classes instead of Remotion animation primitives.
 */

interface TechnicalPromptHeaderProps {
  prompt: string;
}

export function TechnicalPromptHeader({ prompt }: TechnicalPromptHeaderProps) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl px-6 py-5 flex items-center gap-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
      {/* User avatar */}
      <div className="w-10 h-10 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center flex-shrink-0">
        <span className="text-[#6B7280] text-base">U</span>
      </div>

      {/* Prompt text */}
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[10px] font-medium text-[#6B7280] uppercase tracking-wider mb-1">
          User Request
        </div>
        <div className="font-sans text-base font-medium text-[#1A1A1A] leading-snug">
          &ldquo;{prompt}&rdquo;
        </div>
      </div>
    </div>
  );
}
