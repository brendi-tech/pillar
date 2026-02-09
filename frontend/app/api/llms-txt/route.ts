import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.PILLAR_API_URL || 'http://localhost:8003';

/**
 * Proxy endpoint for fetching llms.txt content
 * 
 * GET /api/llms-txt?path=/articles/category/article/llms.txt
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json(
        { error: 'path parameter is required' },
        { status: 400 }
      );
    }

    // Get customer ID from headers (set by middleware)
    const customerId = request.headers.get('x-customer-id') || '';

    // Construct backend URL
    const backendUrl = `${API_BASE_URL}/api/v1/help-center${path}`;

    // Fetch from backend
    const response = await fetch(backendUrl, {
      headers: {
        'x-customer-id': customerId,
        'x-locale': request.headers.get('x-locale') || 'en',
      },
      cache: 'no-store', // Always fetch fresh
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch llms.txt' },
        { status: response.status }
      );
    }

    const content = await response.text();

    // Return as plain text/markdown
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=60', // Cache for 1 minute
      },
    });
  } catch (error) {
    console.error('llms.txt proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch llms.txt' },
      { status: 500 }
    );
  }
}

