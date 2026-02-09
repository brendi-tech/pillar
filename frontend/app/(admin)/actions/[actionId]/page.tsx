'use client';

import { ActionDetailPage } from '@/components/ActionsPageContent';
import { use } from 'react';

interface ActionPageProps {
  params: Promise<{
    actionId: string;
  }>;
}

/**
 * Action detail page - view and edit a specific action.
 */
export default function ActionPage({ params }: ActionPageProps) {
  const { actionId } = use(params);
  
  return <ActionDetailPage actionId={actionId} />;
}
