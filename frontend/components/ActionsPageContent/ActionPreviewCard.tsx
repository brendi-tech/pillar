'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ActionButtonVariant } from '@/types/actions';
import {
  ArrowRight,
  ArrowUpCircle,
  Copy,
  Download,
  Edit,
  ExternalLink,
  Heart,
  Layout,
  Mail,
  MessageCircle,
  PlayCircle,
  Plus,
  Settings,
  Share,
  Star,
  Trash,
  Upload,
  UserPlus,
  X,
  Zap,
  Check,
} from 'lucide-react';

interface ActionPreviewCardProps {
  label: string;
  icon?: string;
  buttonVariant: ActionButtonVariant;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  'arrow-right': <ArrowRight className="h-4 w-4" />,
  'arrow-up-circle': <ArrowUpCircle className="h-4 w-4" />,
  'user-plus': <UserPlus className="h-4 w-4" />,
  'settings': <Settings className="h-4 w-4" />,
  'message-circle': <MessageCircle className="h-4 w-4" />,
  'play-circle': <PlayCircle className="h-4 w-4" />,
  'download': <Download className="h-4 w-4" />,
  'upload': <Upload className="h-4 w-4" />,
  'external-link': <ExternalLink className="h-4 w-4" />,
  'copy': <Copy className="h-4 w-4" />,
  'edit': <Edit className="h-4 w-4" />,
  'trash': <Trash className="h-4 w-4" />,
  'plus': <Plus className="h-4 w-4" />,
  'check': <Check className="h-4 w-4" />,
  'x': <X className="h-4 w-4" />,
  'zap': <Zap className="h-4 w-4" />,
  'star': <Star className="h-4 w-4" />,
  'heart': <Heart className="h-4 w-4" />,
  'share': <Share className="h-4 w-4" />,
  'mail': <Mail className="h-4 w-4" />,
  'layout': <Layout className="h-4 w-4" />,
};

export function ActionPreviewCard({ label, icon, buttonVariant }: ActionPreviewCardProps) {
  const iconElement = icon && ICON_MAP[icon];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border bg-muted/50 p-4">
          <p className="mb-4 text-sm text-muted-foreground">
            How the action button will appear in chat:
          </p>
          <div className="flex justify-center">
            <Button variant={buttonVariant as any}>
              {iconElement && <span className="mr-2">{iconElement}</span>}
              {label}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
