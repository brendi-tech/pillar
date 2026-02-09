/**
 * MDX Components Configuration (Root Level)
 *
 * Required by @next/mdx - must be at project root.
 * Maps component names to implementations for MDX rendering.
 */

import { cn, generateSlug } from "@/lib/utils";
import type { MDXComponents } from "mdx/types";

// Custom MDX components
import {
  AIPromptBlock,
  Callout,
  InfoCallout,
  WarningCallout,
  TipCallout,
  ErrorCallout,
  CodeBlock,
  InlineCode,
  Accordion,
  AccordionItem,
  FAQAccordion,
  Tabs,
  TabList,
  TabTrigger,
  TabContent,
  SimpleTabs,
  Steps,
  StepItem,
  ImageZoom,
  CopyableCodeBlock,
  InteractiveDemo,
  FeatureShowcase,
  FeatureItem,
  PropertyList,
  Property,
  PropertyGroup,
  ConfigReference,
  SyntaxHighlightedPre,
  CodeSnippet,
  CodeSnippetTabs,
} from "@/components/mdx";

/**
 * MDX components hook - required by @next/mdx
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    // Custom MDX components
    AIPromptBlock,
    Callout,
    InfoCallout,
    WarningCallout,
    TipCallout,
    ErrorCallout,
    CodeBlock,
    InlineCode,
    Accordion,
    AccordionItem,
    FAQAccordion,
    Tabs,
    TabList,
    TabTrigger,
    TabContent,
    SimpleTabs,
    Steps,
    StepItem,
    ImageZoom,
    InteractiveDemo,
    FeatureShowcase,
    FeatureItem,
    PropertyList,
    Property,
    PropertyGroup,
    ConfigReference,
    CodeSnippet,
    CodeSnippetTabs,

    // HTML element overrides (matching MarkdownRenderer styling)
    h1: ({ children, ...props }) => {
      const id =
        typeof children === "string" ? generateSlug(children) : undefined;
      return (
        <h1
          id={id}
          className="text-2xl font-bold mt-8 mb-4 scroll-mt-20"
          {...props}
        >
          {children}
        </h1>
      );
    },

    h2: ({ children, ...props }) => {
      const id =
        typeof children === "string" ? generateSlug(children) : undefined;
      return (
        <h2
          id={id}
          className="text-xl font-semibold mt-10 mb-4 scroll-mt-20"
          {...props}
        >
          {children}
        </h2>
      );
    },

    h3: ({ children, ...props }) => {
      const id =
        typeof children === "string" ? generateSlug(children) : undefined;
      return (
        <h3
          id={id}
          className="text-lg font-semibold mt-8 mb-3 scroll-mt-20"
          {...props}
        >
          {children}
        </h3>
      );
    },

    a: ({ href, children, ...props }) => (
      <a href={href} className="text-primary hover:underline" {...props}>
        {children}
      </a>
    ),

    code: ({ className: codeClassName, children, ...props }) => {
      // Check if this is inline code (no language class) vs code block
      const isInline = !codeClassName;
      if (isInline) {
        return (
          <code
            className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono"
            {...props}
          >
            {children}
          </code>
        );
      }
      return (
        <code className={cn("block", codeClassName)} {...props}>
          {children}
        </code>
      );
    },

    pre: ({ children, ...props }) => (
      <SyntaxHighlightedPre {...props}>
        {children}
      </SyntaxHighlightedPre>
    ),

    img: ({ src, alt, ...props }) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className="rounded-lg max-w-full"
        loading="lazy"
        {...props}
      />
    ),

    table: ({ children, ...props }) => (
      <div className="overflow-x-auto my-4">
        <table className="min-w-full divide-y divide-border" {...props}>
          {children}
        </table>
      </div>
    ),

    th: ({ children, ...props }) => (
      <th
        className="px-4 py-2 text-left text-sm font-semibold bg-muted"
        {...props}
      >
        {children}
      </th>
    ),

    td: ({ children, ...props }) => (
      <td className="px-4 py-2 text-sm border-b border-border" {...props}>
        {children}
      </td>
    ),

    ul: ({ children, ...props }) => (
      <ul className="list-disc pl-6 my-4 space-y-2" {...props}>
        {children}
      </ul>
    ),

    ol: ({ children, ...props }) => (
      <ol className="list-decimal pl-6 my-4 space-y-2" {...props}>
        {children}
      </ol>
    ),

    blockquote: ({ children, ...props }) => (
      <blockquote
        className="border-l-4 border-primary pl-4 my-3 italic text-muted-foreground"
        {...props}
      >
        {children}
      </blockquote>
    ),

    hr: (props) => <hr className="my-6 border-border" {...props} />,

    p: ({ children, ...props }) => (
      <p className="my-4 leading-7" {...props}>
        {children}
      </p>
    ),

    // Spread any additional components passed in
    ...components,
  };
}
