'use client';

import { cn } from '@/lib/utils';
import type { KnowledgeSourceTypeOption } from '@/types/knowledge';
import { FileText, Globe, HelpCircle, Cloud, Upload, BookOpen } from 'lucide-react';

interface SelectSourceTypeProps {
  options: KnowledgeSourceTypeOption[];
  selected: KnowledgeSourceTypeOption | null;
  onSelect: (type: KnowledgeSourceTypeOption) => void;
}

const iconMap: Record<string, typeof Globe> = {
  HelpCircle: HelpCircle,
  Globe: Globe,
  FileText: FileText,
  BookOpen: BookOpen,
  Cloud: Cloud,
  Upload: Upload,
};

export function SelectSourceType({
  options,
  selected,
  onSelect,
}: SelectSourceTypeProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Select Source Type</h2>
        <p className="text-sm text-muted-foreground">
          Choose the type of knowledge source you want to add.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => {
          const Icon = iconMap[option.icon] || Globe;
          const isSelected = selected?.id === option.id;

          return (
            <button
              key={option.id}
              onClick={() => onSelect(option)}
              className={cn(
                'flex flex-col items-start gap-3 rounded-lg border p-4 text-left transition-all hover:border-primary/50 hover:bg-muted/50',
                isSelected && 'border-primary bg-primary/5 ring-1 ring-primary'
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg',
                  isSelected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-medium">{option.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {option.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
