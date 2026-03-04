import { SectionLabel } from "@/components/shared";

import type { ExamplePhrasesProps } from "./ToolDetailPage.types";

export function ExamplePhrases({ examples }: ExamplePhrasesProps) {
  if (!examples || examples.length === 0) return null;

  return (
    <div>
      <SectionLabel
        className="mb-2"
        annotation={<>&mdash; improve search ranking, not seen by the AI</>}
      >
        Example Phrases
      </SectionLabel>
      <div className="flex flex-wrap gap-1.5">
        {examples.map((example, i) => (
          <span
            key={i}
            className="inline-block rounded-full border bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground"
          >
            {example}
          </span>
        ))}
      </div>
    </div>
  );
}
