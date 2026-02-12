'use client';

import { cn } from '@/lib/utils';
import type { ActionType } from '@/types/actions';
import { ACTION_TYPE_LABELS, ACTION_TYPE_DESCRIPTIONS, ACTION_TYPE_ICONS } from '@/types/actions';
import {
  ArrowRight,
  Copy,
  ExternalLink,
  Layout,
  Pencil,
  PlayCircle,
  Zap,
} from 'lucide-react';

interface ActionTypeSelectorProps {
  value: ActionType;
  onChange: (type: ActionType) => void;
  disabled?: boolean;
}

const ICON_COMPONENTS: Record<string, React.ComponentType<{ className?: string }>> = {
  'arrow-right': ArrowRight,
  'layout': Layout,
  'edit-3': Pencil,
  'zap': Zap,
  'copy': Copy,
  'external-link': ExternalLink,
  'play-circle': PlayCircle,
};

const ACTION_TYPES: ActionType[] = [
  'trigger_tool',
  'navigate',
  'open_modal',
  'external_link',
  'copy_text',
  'start_tutorial',
];

export function ActionTypeSelector({ value, onChange, disabled }: ActionTypeSelectorProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {ACTION_TYPES.map((type) => {
        const iconName = ACTION_TYPE_ICONS[type];
        const IconComponent = ICON_COMPONENTS[iconName] || Zap;
        const isSelected = value === type;

        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            disabled={disabled}
            className={cn(
              'flex flex-col items-start rounded-lg border p-4 text-left transition-colors',
              isSelected
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50 hover:bg-accent',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
              )}
            >
              <IconComponent className="h-5 w-5" />
            </div>
            <div className="mt-3 font-medium">{ACTION_TYPE_LABELS[type]}</div>
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {ACTION_TYPE_DESCRIPTIONS[type]}
            </p>
          </button>
        );
      })}
    </div>
  );
}
