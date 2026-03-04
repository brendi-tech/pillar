/**
 * Validates a secret name for format requirements.
 * @returns Error message if invalid, null if valid
 */
export function validateSecretName(name: string): string | null {
  if (!name.trim()) {
    return "Name is required";
  }
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(name.toLowerCase())) {
    return "Use lowercase letters, numbers, and hyphens only";
  }
  if (name.length > 50) {
    return "Name must be 50 characters or less";
  }
  return null;
}

/**
 * Sanitizes user input for secret name (lowercase, allowed chars only)
 */
export function sanitizeSecretName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "");
}
