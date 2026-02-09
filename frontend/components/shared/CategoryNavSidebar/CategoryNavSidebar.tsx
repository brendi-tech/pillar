'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import type { CategoryNavSidebarProps } from './CategoryNavSidebar.types';

export function CategoryNavSidebar({
  categories,
  activeCategory,
  onCategorySelect,
  allLabel = 'All',
  allCount,
  footerAction,
  className,
}: CategoryNavSidebarProps) {
  return (
    <div
      className={cn(
        'flex h-full w-[200px] flex-col border-r bg-card',
        className
      )}
    >
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-3">
          {/* All Button */}
          <Button
            variant="ghost"
            className={cn(
              'w-full justify-start gap-2 px-3',
              activeCategory === null &&
                'bg-muted text-foreground font-medium'
            )}
            onClick={() => onCategorySelect(null)}
          >
            <LayoutGrid className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">{allLabel}</span>
            {allCount !== undefined && allCount > 0 && (
              <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-xs">
                {allCount}
              </Badge>
            )}
          </Button>

          {/* Category Buttons */}
          {categories.map((category) => {
            const Icon = category.icon;
            const isActive = activeCategory === category.id;

            return (
              <Button
                key={category.id}
                variant="ghost"
                className={cn(
                  'w-full justify-start gap-2 px-3',
                  isActive && 'bg-muted text-foreground font-medium'
                )}
                onClick={() => onCategorySelect(category.id)}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left truncate">{category.name}</span>
                {category.count > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-auto h-5 px-1.5 text-xs"
                  >
                    {category.count}
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer Action */}
      {footerAction && (
        <div className="border-t p-3">
          <Button variant="outline" className="w-full gap-2" asChild>
            <Link href={footerAction.href}>
              <footerAction.icon className="h-4 w-4" />
              {footerAction.label}
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}




