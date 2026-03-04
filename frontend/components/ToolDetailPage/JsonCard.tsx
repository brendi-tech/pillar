import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { JsonCardProps, ParameterExamplesCardProps } from "./ToolDetailPage.types";

export function JsonCard({ title, description, data }: JsonCardProps) {
  if (!data || Object.keys(data).length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
          {JSON.stringify(data, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}

export function ParameterExamplesCard({ examples }: ParameterExamplesCardProps) {
  if (!examples || examples.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parameter Examples</CardTitle>
        <CardDescription>Example parameter sets for this action</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {examples.map((example, i) => (
          <div key={i} className="rounded-lg border p-3">
            {example.description && (
              <div className="mb-2 text-xs font-medium">
                {example.description}
              </div>
            )}
            <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
              {JSON.stringify(example.parameters, null, 2)}
            </pre>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
