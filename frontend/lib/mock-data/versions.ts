/**
 * Product Versions
 * 
 * Each article can have content for multiple product versions.
 * The version picker allows users to switch between them.
 */

export interface ProductVersion {
  id: string;
  name: string;
  isLatest: boolean;
  releasedAt: string;
  description?: string;
}

export const PRODUCT_VERSIONS: ProductVersion[] = [
  { 
    id: '2024.2', 
    name: '2024.2', 
    isLatest: true, 
    releasedAt: '2024-11-01',
    description: 'Current release with AI features'
  },
  { 
    id: '2024.1', 
    name: '2024.1', 
    isLatest: false, 
    releasedAt: '2024-08-01',
    description: 'Added integrations and webhooks'
  },
  { 
    id: '2023.4', 
    name: '2023.4', 
    isLatest: false, 
    releasedAt: '2023-12-01',
    description: 'Legacy version'
  },
];

export function getLatestVersion(): ProductVersion {
  return PRODUCT_VERSIONS.find(v => v.isLatest) || PRODUCT_VERSIONS[0];
}

export function getVersionById(id: string): ProductVersion | undefined {
  return PRODUCT_VERSIONS.find(v => v.id === id);
}


