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

export interface GeneratedSecret {
  secret: string;
  name: string;
}
