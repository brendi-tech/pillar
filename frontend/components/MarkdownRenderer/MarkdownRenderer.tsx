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
 */
export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  if (!content) {
    return <p className="text-muted-foreground">No content available.</p>;
  }

  return (
    <div className={cn('prose-hc', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeSlug]}
        components={{
        h1: ({ children, ...props }) => {
          const id = typeof children === 'string' ? generateSlug(children) : undefined;
          return (
            <h1 id={id} className="text-2xl font-bold mt-8 mb-4 scroll-mt-20" {...props}>
              {children}
            </h1>
          );
        },
        h2: ({ children, ...props }) => {
          const id = typeof children === 'string' ? generateSlug(children) : undefined;
          return (
            <h2 id={id} className="text-xl font-semibold mt-6 mb-3 scroll-mt-20" {...props}>
              {children}
            </h2>
          );
        },
        h3: ({ children, ...props }) => {
          const id = typeof children === 'string' ? generateSlug(children) : undefined;
          return (
            <h3 id={id} className="text-lg font-semibold mt-4 mb-2 scroll-mt-20" {...props}>
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
          return (
            <a href={href} className="text-primary hover:underline" {...props}>
              {children}
            </a>
          );
        },
        code: ({ className: codeClassName, children, ...props }) => {
          // Check if this is inline code (no language class) vs code block
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
            className="border-l-4 border-primary pl-4 my-4 italic text-muted-foreground"
            {...props}
          >
            {children}
          </blockquote>
        ),
        hr: (props) => <hr className="my-8 border-border" {...props} />,
        p: ({ children, ...props }) => (
          <p className="my-4 leading-7" {...props}>
            {children}
          </p>
        ),
      }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

