'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Check } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

interface SnippetFormProps {
  onBack: () => void;
  onSubmit: (data: { name: string; content: string }) => void;
  isSubmitting?: boolean;
}

export function SnippetForm({ onBack, onSubmit, isSubmitting }: SnippetFormProps) {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name: name.trim(), content: content.trim() });
  };

  const isValid = name.trim() !== '' && content.trim() !== '';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Custom Snippet</h2>
        <p className="text-sm text-muted-foreground">
          Add custom text content for the AI to reference. Use this for product details, company policies, or specific instructions.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Title</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Refund Policy, Product Pricing, Company Info"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="content">Content</Label>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter your snippet content here...

Example:
Our refund policy allows customers to request a full refund within 30 days of purchase. For digital products, refunds are only available if the product has not been downloaded or accessed."
            rows={10}
            className="resize-y min-h-[200px]"
          />
          <p className="text-xs text-muted-foreground">
            This content will be indexed and used by the AI to answer questions.
          </p>
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button type="submit" disabled={!isValid || isSubmitting}>
          {isSubmitting ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Creating...
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Create Snippet
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
