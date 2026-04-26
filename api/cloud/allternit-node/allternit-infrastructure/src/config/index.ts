import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (value === undefined) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value;
}

function getEnvVarAsInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid integer`);
  }
  return parsed;
}

function getEnvVarAsBool(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true' || value === '1';
}

function getEnvVarAsArray(key: string, defaultValue: string[] = []): string[] {
  const value = process.env[key];
  if (value === undefined || value === '') {
    return defaultValue;
  }
  return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

export const config = {
  // Server Configuration
  server: {
    nodeEnv: getEnvVar('NODE_ENV', 'development'),
    port: getEnvVarAsInt('PORT', 3000),
    host: getEnvVar('HOST', '0.0.0.0'),
    apiVersion: getEnvVar('API_VERSION', 'v1'),
    isDevelopment: getEnvVar('NODE_ENV', 'development') === 'development',
    isProduction: getEnvVar('NODE_ENV', 'development') === 'production',
  },

  // Database Configuration
  database: {
    url: getEnvVar('DATABASE_URL', 'postgresql://user:password@localhost:5432/allternit_infrastructure'),
    host: getEnvVar('DB_HOST', 'localhost'),
    port: getEnvVarAsInt('DB_PORT', 5432),
    name: getEnvVar('DB_NAME', 'allternit_infrastructure'),
    user: getEnvVar('DB_USER', 'allternit_user'),
    password: getEnvVar('DB_PASSWORD', 'secure_password'),
    poolSize: getEnvVarAsInt('DB_POOL_SIZE', 20),
    sslMode: getEnvVar('DB_SSL_MODE', 'disable'),
  },

  // Redis Configuration
  redis: {
    url: getEnvVar('REDIS_URL', 'redis://localhost:6379'),
    host: getEnvVar('REDIS_HOST', 'localhost'),
    port: getEnvVarAsInt('REDIS_PORT', 6379),
    password: getEnvVar('REDIS_PASSWORD', ''),
    db: getEnvVarAsInt('REDIS_DB', 0),
    keyPrefix: getEnvVar('REDIS_KEY_PREFIX', 'allternit:'),
  },

  // Security Configuration
  security: {
    jwtSecret: getEnvVar('JWT_SECRET', 'default-secret-change-in-production'),
    encryptionKey: getEnvVar('ENCRYPTION_KEY', 'default-encryption-key!!'),
    apiKeyHeader: getEnvVar('API_KEY_HEADER', 'x-api-key'),
    apiKeys: getEnvVarAsArray('API_KEYS', []),
  },

  // CORS Configuration
  cors: {
    origin: getEnvVar('CORS_ORIGIN', '*'),
    credentials: getEnvVarAsBool('CORS_CREDENTIALS', true),
  },

  // Rate Limiting
  rateLimit: {
    max: getEnvVarAsInt('RATE_LIMIT_MAX', 100),
    windowMs: getEnvVarAsInt('RATE_LIMIT_WINDOW_MS', 60000),
  },

  // Logging Configuration
  logging: {
    level: getEnvVar('LOG_LEVEL', 'info'),
    format: getEnvVar('LOG_FORMAT', 'json'),
  },

  // Cloud Provider Configuration
  cloudProviders: {
    hetzner: {
      apiKey: getEnvVar('HETZNER_API_KEY', ''),
      apiUrl: getEnvVar('HETZNER_API_URL', 'https://api.hetzner.cloud/v1'),
      enabled: getEnvVarAsBool('ENABLE_CLOUD_PROVIDERS', true),
    },
    digitalOcean: {
      apiKey: getEnvVar('DIGITALOCEAN_API_KEY', ''),
      apiUrl: getEnvVar('DIGITALOCEAN_API_URL', 'https://api.digitalocean.com/v2'),
      enabled: getEnvVarAsBool('ENABLE_CLOUD_PROVIDERS', true),
    },
    aws: {
      accessKeyId: getEnvVar('AWS_ACCESS_KEY_ID', ''),
      secretAccessKey: getEnvVar('AWS_SECRET_ACCESS_KEY', ''),
      defaultRegion: getEnvVar('AWS_DEFAULT_REGION', 'us-east-1'),
      enabled: getEnvVarAsBool('ENABLE_CLOUD_PROVIDERS', true),
    },
  },

  // SSH Configuration
  ssh: {
    timeoutMs: getEnvVarAsInt('SSH_TIMEOUT_MS', 30000),
    privateKeyPath: getEnvVar('SSH_PRIVATE_KEY_PATH', '~/.ssh/id_rsa'),
    knownHostsPath: getEnvVar('SSH_KNOWN_HOSTS_PATH', '~/.ssh/known_hosts'),
  },

  // Docker Configuration
  docker: {
    registry: getEnvVar('DOCKER_REGISTRY', 'https://index.docker.io/v1/'),
    username: getEnvVar('DOCKER_REGISTRY_USERNAME', ''),
    password: getEnvVar('DOCKER_REGISTRY_PASSWORD', ''),
  },

  // WebSocket Configuration
  websocket: {
    heartbeatInterval: getEnvVarAsInt('WS_HEARTBEAT_INTERVAL', 30000),
    maxConnections: getEnvVarAsInt('WS_MAX_CONNECTIONS', 1000),
  },

  // Feature Flags
  features: {
    enableCloudProviders: getEnvVarAsBool('ENABLE_CLOUD_PROVIDERS', true),
    enableVPSAutomation: getEnvVarAsBool('ENABLE_VPS_AUTOMATION', true),
    enableEnvironmentProvisioning: getEnvVarAsBool('ENABLE_ENVIRONMENT_PROVISIONING', true),
  },
} as const;

export default config;
