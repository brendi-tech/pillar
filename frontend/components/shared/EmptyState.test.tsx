import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState, NoSearchResults, NoArticles } from './EmptyState';

describe('EmptyState Component', () => {
  it('should render the title', () => {
    render(<EmptyState title="Test Title" />);
    
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('should render the description when provided', () => {
    render(
      <EmptyState
        title="Test Title"
        description="Test description"
      />
    );
    
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('should render action button when provided', () => {
    const mockOnClick = vi.fn();
    render(
      <EmptyState
        title="Test Title"
        action={{
          label: 'Click me',
          onClick: mockOnClick,
        }}
      />
    );
    
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
  });

  it('should render action link when href is provided', () => {
    render(
      <EmptyState
        title="Test Title"
        action={{
          label: 'Go home',
          href: '/',
        }}
      />
    );
    
    const link = screen.getByRole('link', { name: /go home/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/');
  });

  it('should render with default file icon', () => {
    render(<EmptyState title="Test Title" />);
    
    // The icon should be rendered (we can check for the container)
    const iconContainer = screen.getByText('Test Title').closest('div')?.querySelector('svg');
    expect(iconContainer).toBeInTheDocument();
  });

  it('should render with search icon when specified', () => {
    render(<EmptyState title="Test Title" icon="search" />);
    
    // The search icon should be rendered
    const iconContainer = screen.getByText('Test Title').closest('div')?.querySelector('svg');
    expect(iconContainer).toBeInTheDocument();
  });
});

describe('NoSearchResults Component', () => {
  it('should render with query', () => {
    render(<NoSearchResults query="test query" />);
    
    expect(screen.getByText('No results found')).toBeInTheDocument();
    expect(screen.getByText(/No articles match "test query"/i)).toBeInTheDocument();
  });

  it('should render without query', () => {
    render(<NoSearchResults />);
    
    expect(screen.getByText('No results found')).toBeInTheDocument();
    expect(screen.getByText(/Try searching for something else/i)).toBeInTheDocument();
  });

  it('should have browse categories link', () => {
    render(<NoSearchResults />);
    
    const link = screen.getByRole('link', { name: /browse categories/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/');
  });
});

describe('NoArticles Component', () => {
  it('should render correctly', () => {
    render(<NoArticles />);
    
    expect(screen.getByText('No articles yet')).toBeInTheDocument();
    expect(screen.getByText(/This category doesn't have any articles yet/i)).toBeInTheDocument();
  });

  it('should have go home link', () => {
    render(<NoArticles />);
    
    const link = screen.getByRole('link', { name: /go home/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/');
  });
});

