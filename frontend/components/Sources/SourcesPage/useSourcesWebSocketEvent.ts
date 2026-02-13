import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocketEvent } from '@/hooks/use-websocket-event';
import { knowledgeKeys } from '@/queries/knowledge.queries';
import type { KnowledgeItem, KnowledgeItemListResponse } from '@/types/knowledge';

interface UseSourcesWebSocketEventOptions {
  sourceId: string;
  pageSize: number;
}

/**
 * Hook to handle WebSocket events for knowledge items in the sources sidebar.
 *
 * - On `knowledge_item.created`: Adds new items directly to the query cache
 * - On `source.sync_completed`: Invalidates the cache to get fresh data
 */
export function useSourcesWebSocketEvent({
  sourceId,
  pageSize,
}: UseSourcesWebSocketEventOptions): void {
  const queryClient = useQueryClient();

  // Add new items to cache when created (optimistic update)
  useWebSocketEvent(
    'websocket:knowledge_item.created',
    useCallback(
      (event: CustomEvent) => {
        const itemData = event.detail;
        if (itemData?.source !== sourceId) return;

        // Add the new item to the first page of the infinite query cache
        queryClient.setQueryData<{ pages: KnowledgeItemListResponse[]; pageParams: number[] }>(
          knowledgeKeys.itemList({ source: sourceId, page_size: pageSize }),
          (oldData) => {
            if (!oldData) return oldData;

            // Create the new item from WebSocket data
            const newItem: KnowledgeItem = {
              id: itemData.id,
              source: itemData.source,
              source_name: itemData.source_name || '',
              item_type: itemData.item_type || 'page',
              url: itemData.url || null,
              external_id: itemData.external_id || '',
              title: itemData.title || '',
              raw_content: '',
              optimized_content: null,
              has_optimized_content: itemData.has_optimized_content || false,
              excerpt: itemData.excerpt || null,
              status: itemData.status || 'pending',
              status_display: itemData.status_display || 'Pending',
              content_hash: '',
              processing_error: '',
              is_active: itemData.is_active ?? true,
              metadata: {},
              chunk_count: itemData.chunk_count || 0,
              created_at: itemData.created_at || new Date().toISOString(),
              updated_at: itemData.updated_at || new Date().toISOString(),
            };

            // Check if item already exists in any page
            const existsInCache = oldData.pages.some(page =>
              page.results.some(item => item.id === newItem.id)
            );
            if (existsInCache) return oldData;

            // Add to the beginning of the first page
            const newPages = [...oldData.pages];
            if (newPages[0]) {
              newPages[0] = {
                ...newPages[0],
                count: newPages[0].count + 1,
                results: [newItem, ...newPages[0].results],
              };
            }

            return { ...oldData, pages: newPages };
          }
        );
      },
      [sourceId, queryClient, pageSize]
    )
  );

  // Invalidate cache when sync completes to get accurate data
  useWebSocketEvent(
    'websocket:source.sync_completed',
    useCallback(
      (event: CustomEvent) => {
        if (event.detail?.source_id === sourceId) {
          queryClient.invalidateQueries({
            queryKey: knowledgeKeys.itemList({ source: sourceId, page_size: pageSize }),
          });
        }
      },
      [sourceId, queryClient, pageSize]
    )
  );
}
