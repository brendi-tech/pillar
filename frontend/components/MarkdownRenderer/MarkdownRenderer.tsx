'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import { cn, generateSlug } from '@/lib/utils';

function getYouTubeVideoId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/
  );
  return match?.[1] ?? null;
}

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Renders markdown content with GitHub Flavored Markdown support,
 * syntax highlighting, and heading anchors.
 *
 * Expects a parent element with Tailwind Typography `prose` classes
 * to handle spacing, sizes, and colors.
 */
export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  if (!content) {
    return <p className="text-muted-foreground">No content available.</p>;
  }

  return (
    <div className={cn(className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeSlug]}
        components={{
        h1: ({ children, ...props }) => {
          const id = typeof children === 'string' ? generateSlug(children) : undefined;
          return (
            <h1 id={id} className="scroll-mt-20" {...props}>
              {children}
            </h1>
          );
        },
        h2: ({ children, ...props }) => {
          const id = typeof children === 'string' ? generateSlug(children) : undefined;
          return (
            <h2 id={id} className="scroll-mt-20" {...props}>
              {children}
            </h2>
          );
        },
        h3: ({ children, ...props }) => {
          const id = typeof children === 'string' ? generateSlug(children) : undefined;
          return (
            <h3 id={id} className="scroll-mt-20" {...props}>
              {children}
            </h3>
          );
        },
        a: ({ href, children, ...props }) => {
          const videoId = href ? getYouTubeVideoId(href) : null;
          if (videoId) {
            return (
              <div className="my-6 aspect-video">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${videoId}`}
                  title={typeof children === 'string' ? children : 'YouTube video'}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full rounded-lg"
                />
              </div>
            );
          }
          const isExternal =
            !!href &&
            (href.startsWith('http://') || href.startsWith('https://')) &&
            !href.startsWith('https://trypillar.com') &&
            !href.startsWith('http://trypillar.com');
          return (
            <a
              href={href}
              {...(isExternal
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
              {...props}
            >
              {children}
            </a>
          );
        },
        code: ({ className: codeClassName, children, ...props }) => {
          const isInline = !codeClassName;
          if (isInline) {
            return (
              <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                {children}
              </code>
            );
          }
          return (
            <code className={cn('block', codeClassName)} {...props}>
              {children}
            </code>
          );
        },
        pre: ({ children, ...props }) => (
          <pre
            className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto"
            {...props}
          >
            {children}
          </pre>
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
      }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
