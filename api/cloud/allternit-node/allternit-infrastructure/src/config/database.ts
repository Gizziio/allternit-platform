import { Pool, PoolClient, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import config from './index';
import { logger } from '../utils/logger';

// Connection pool configuration
const poolConfig: PoolConfig = {
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  max: config.database.poolSize,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  application_name: 'allternit-infrastructure',
};

// Add SSL configuration if needed
if (config.database.sslMode === 'require' || config.database.sslMode === 'prefer') {
  poolConfig.ssl = {
    rejectUnauthorized: config.database.sslMode === 'require',
  };
}

// Create connection pool
const pool = new Pool(poolConfig);

// Pool event handlers
pool.on('connect', () => {
  logger.debug('New database connection established');
});

pool.on('acquire', () => {
  logger.debug('Database connection acquired from pool');
});

pool.on('remove', () => {
  logger.debug('Database connection removed from pool');
});

pool.on('error', (err: Error) => {
  logger.error('Unexpected database pool error', { error: err.message, stack: err.stack });
});

/**
 * Execute a query with automatic connection handling
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    logger.debug('Database query executed', {
      query: text.substring(0, 100),
      duration: `${duration}ms`,
      rows: result.rowCount,
    });
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error('Database query failed', {
      query: text.substring(0, 100),
      duration: `${duration}ms`,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Get a client from the pool for transaction handling
 */
export async function getClient(): Promise<PoolClient> {
  try {
    const client = await pool.connect();
    const originalQuery = client.query.bind(client);
    const originalRelease = client.release.bind(client);

    // Track if release has been called
    let released = false;

    // Override release to log and track
    client.release = () => {
      if (released) {
        logger.warn('Client release called multiple times');
        return;
      }
      released = true;
      originalRelease();
      logger.debug('Database client released back to pool');
    };

    // Override query to log
    client.query = async (...args: any[]) => {
      const start = Date.now();
      try {
        const result = await (originalQuery as any)(...args);
        const duration = Date.now() - start;
        logger.debug('Client query executed', {
          query: typeof args[0] === 'string' ? args[0].substring(0, 100) : 'Parameterized query',
          duration: `${duration}ms`,
        });
        return result;
      } catch (error) {
        const duration = Date.now() - start;
        logger.error('Client query failed', {
          query: typeof args[0] === 'string' ? args[0].substring(0, 100) : 'Parameterized query',
          duration: `${duration}ms`,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    };

    return client;
  } catch (error) {
    logger.error('Failed to acquire database client', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Execute a transaction with automatic commit/rollback
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    logger.debug('Transaction started');
    
    const result = await callback(client);
    
    await client.query('COMMIT');
    logger.debug('Transaction committed');
    
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW() as now');
    logger.info('Database connection successful', { serverTime: result.rows[0].now });
    return true;
  } catch (error) {
    logger.error('Database connection failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Close all database connections
 */
export async function closePool(): Promise<void> {
  logger.info('Closing database connection pool');
  await pool.end();
  logger.info('Database connection pool closed');
}

/**
 * Check database health
 */
export async function healthCheck(): Promise<{ healthy: boolean; latency: number; message?: string }> {
  const start = Date.now();
  try {
    await query('SELECT 1');
    const latency = Date.now() - start;
    return {
      healthy: true,
      latency,
    };
  } catch (error) {
    const latency = Date.now() - start;
    return {
      healthy: false,
      latency,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export { pool };
export default pool;
