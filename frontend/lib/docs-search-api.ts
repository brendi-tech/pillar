/**
 * Docs Search API
 *
 * Utility for calling MCP keyword_search to search docs content.
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_PILLAR_API_URL || "http://localhost:8003";

export interface SearchResult {
  id: string;
  title: string;
  excerpt: string;
  url: string;
  source_name?: string;
  item_type?: string;
  score?: number;
}

interface MCPResponse {
  jsonrpc: string;
  id: number;
  result?: {
    success: boolean;
    results: SearchResult[];
    result_count: number;
    query: string;
  };
  error?: {
    code: number;
    message: string;
  };
}

/**
 * Search docs using MCP keyword_search tool.
 * Throws on network/API errors so callers can display error state.
 */
export async function searchDocs(
  query: string,
  topK = 10
): Promise<SearchResult[]> {
  if (!query.trim()) {
    return [];
  }

  const response = await fetch(`${API_BASE_URL}/mcp/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-customer-id": "pillar-docs", // Site context
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: {
        name: "keyword_search",
        arguments: { query, top_k: topK },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Search unavailable (${response.status})`);
  }

  const data: MCPResponse = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  return data.result?.results || [];
}
