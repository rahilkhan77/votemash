/**
 * Safe environment variable access utility
 * Validates required variables at runtime
 * Prevents exposure of secrets to the browser
 */

function getEnv(key: string, isPublic: boolean = false): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  if (!isPublic && key.startsWith('NEXT_PUBLIC_')) {
    throw new Error(`Environment variable ${key} should not be accessed as a secret`);
  }

  return value;
}

export const env = {
  app: {
    url: getEnv('NEXT_PUBLIC_APP_URL', true),
  },

  // Server-only
  databaseUrl: () => getEnv('DATABASE_URL'),
  dodo: {
    apiKey: () => getEnv('DODO_PAYMENTS_API_KEY'),
    webhookSecret: () => getEnv('DODO_WEBHOOK_SECRET'),
    productId5: () => getEnv('DODO_PAYMENTS_PRODUCT_ID_5'),
    productId9: () => getEnv('DODO_PAYMENTS_PRODUCT_ID_9'),
  },
};

// Validate required env vars on startup (server-side only)
export function validateEnv() {
  if (typeof window === 'undefined') {
    // Server-side validation
    try {
      getEnv('DATABASE_URL');
      getEnv('DODO_PAYMENTS_API_KEY');
      getEnv('DODO_WEBHOOK_SECRET');
      getEnv('DODO_PAYMENTS_PRODUCT_ID_5');
      getEnv('DODO_PAYMENTS_PRODUCT_ID_9');
      getEnv('NEXT_PUBLIC_APP_URL', true);
    } catch (error) {
      console.error('Environment validation failed:', error);
      throw error;
    }
  }
}
