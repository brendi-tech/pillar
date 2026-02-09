'use client';

import { useState, createContext, useContext } from 'react';
import { cn } from '@/lib/utils';

// Context for tabs
interface TabsContextValue {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tab components must be used within a Tabs component');
  }
  return context;
}

// Main Tabs container
interface TabsProps {
  defaultTab?: string;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({ defaultTab, children, className }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || '');

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={cn('my-4', className)}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

// Tab list (container for tab triggers)
interface TabListProps {
  children: React.ReactNode;
  className?: string;
}

export function TabList({ children, className }: TabListProps) {
  return (
    <div
      className={cn(
        'flex border-b border-border overflow-x-auto',
        className
      )}
      role="tablist"
    >
      {children}
    </div>
  );
}

// Individual tab trigger
interface TabTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function TabTrigger({ value, children, className }: TabTriggerProps) {
  const { activeTab, setActiveTab } = useTabsContext();
  const isActive = activeTab === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => setActiveTab(value)}
      className={cn(
        'px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors relative',
        'hover:text-foreground',
        isActive
          ? 'text-foreground'
          : 'text-muted-foreground',
        className
      )}
    >
      {children}
      {isActive && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
      )}
    </button>
  );
}

// Tab content panel
interface TabContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function TabContent({ value, children, className }: TabContentProps) {
  const { activeTab } = useTabsContext();

  if (activeTab !== value) {
    return null;
  }

  return (
    <div
      role="tabpanel"
      className={cn('py-4', className)}
    >
      {children}
    </div>
  );
}

// Simple tabs component for basic use cases
interface SimpleTabsProps {
  tabs: {
    label: string;
    value: string;
    content: React.ReactNode;
  }[];
  defaultValue?: string;
  className?: string;
}

export function SimpleTabs({ tabs, defaultValue, className }: SimpleTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultValue || tabs[0]?.value || '');

  return (
    <div className={cn('my-4', className)}>
      {/* Tab triggers */}
      <div className="flex border-b border-border overflow-x-auto" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={activeTab === tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              'px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors relative',
              'hover:text-foreground',
              activeTab === tab.value
                ? 'text-foreground'
                : 'text-muted-foreground'
            )}
          >
            {tab.label}
            {activeTab === tab.value && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="py-4" role="tabpanel">
        {tabs.find((tab) => tab.value === activeTab)?.content}
      </div>
    </div>
  );
}


