import { NextResponse } from 'next/server';

/**
 * Health check endpoint for Cloud Run startup/liveness probes.
 * Returns a simple 200 OK response without any backend dependencies.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
