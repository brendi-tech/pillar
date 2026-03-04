export interface ToolsSyncModalProps {
  trigger?: React.ReactNode;
}

export interface SyncSecret {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  created_by_email: string | null;
}

export interface CreateSecretResponse {
  id: string;
  name: string;
  secret: string;
  message: string;
}

export interface SecretsTableProps {
  productId: string;
  onSecretCreated: (secret: string, name: string) => void;
}

export interface NewlyGeneratedSecret {
  secret: string;
  name: string;
}
