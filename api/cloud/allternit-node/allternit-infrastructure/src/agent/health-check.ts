/**
 * A2R Agent Health Check Module
 * 
 * Provides comprehensive health checking for the A2R agent and its dependencies.
 * Can be used as an endpoint handler or standalone health checker.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { Logger } from '../utils/logger';

const execAsync = promisify(exec);

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: ComponentHealth[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  message?: string;
  details?: Record<string, any>;
  lastChecked: string;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  network: {
    connections: number;
    bytesIn: number;
    bytesOut: number;
  };
}

export interface DockerContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  health?: string;
  cpuUsage?: number;
  memoryUsage?: number;
  uptime: number;
}

export class HealthChecker {
  private readonly logger: Logger;
  private readonly version: string;
  private startTime: number;
  private configPath: string;

  constructor(configPath: string = '/etc/a2r/config.json') {
    this.logger = new Logger('HealthChecker');
    this.version = process.env.ALLTERNIT_VERSION || '1.0.0';
    this.startTime = Date.now();
    this.configPath = configPath;
  }

  /**
   * Perform complete health check of the A2R agent
   */
  async checkHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checks: ComponentHealth[] = [];

    // Run all health checks in parallel
    const results = await Promise.allSettled([
      this.checkAgentService(),
      this.checkDocker(),
      this.checkRedis(),
      this.checkDiskSpace(),
      this.checkMemory(),
      this.checkNetwork(),
      this.checkConfig(),
      this.checkDependencies()
    ]);

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        checks.push(result.value);
      } else {
        checks.push({
          name: this.getCheckName(index),
          status: 'unhealthy',
          responseTime: 0,
          message: result.reason?.message || 'Check failed',
          lastChecked: new Date().toISOString()
        });
      }
    });

    // Calculate summary
    const summary = {
      total: checks.length,
      healthy: checks.filter(c => c.status === 'healthy').length,
      degraded: checks.filter(c => c.status === 'degraded').length,
      unhealthy: checks.filter(c => c.status === 'unhealthy').length
    };

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (summary.unhealthy > 0) {
      status = 'unhealthy';
    } else if (summary.degraded > 0) {
      status = 'degraded';
    }

    const responseTime = Date.now() - startTime;
    this.logger.debug(`Health check completed in ${responseTime}ms: ${status}`);

    return {
      status,
      timestamp: new Date().toISOString(),
      version: this.version,
      uptime: Date.now() - this.startTime,
      checks,
      summary
    };
  }

  /**
   * Check if the A2R agent service is running properly
   */
  async checkAgentService(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      // Check systemd service status
      const { stdout } = await execAsync('systemctl is-active a2r-agent');
      const isActive = stdout.trim() === 'active';

      // Check if main container is running
      const containerResult = await execAsync(
        'docker ps --filter "name=a2r-agent" --filter "status=running" --format "{{.Names}}"'
      );
      const containerRunning = containerResult.stdout.trim() === 'a2r-agent';

      if (isActive && containerRunning) {
        return {
          name: 'agent-service',
          status: 'healthy',
          responseTime: Date.now() - startTime,
          message: 'A2R agent service and container are running',
          lastChecked: new Date().toISOString()
        };
      } else {
        return {
          name: 'agent-service',
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          message: `Service: ${isActive ? 'active' : 'inactive'}, Container: ${containerRunning ? 'running' : 'not running'}`,
          lastChecked: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        name: 'agent-service',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: `Failed to check service status: ${error}`,
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Check Docker daemon status
   */
  async checkDocker(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      // Check Docker daemon
      const { stdout: versionOutput } = await execAsync('docker version --format "{{.Server.Version}}"');
      const dockerVersion = versionOutput.trim();

      // Check Docker Compose
      const { stdout: composeOutput } = await execAsync('docker compose version');
      const composeVersion = composeOutput.trim();

      // Get container stats
      const { stdout: containerCount } = await execAsync('docker ps -q | wc -l');
      const runningContainers = parseInt(containerCount.trim()) || 0;

      return {
        name: 'docker',
        status: 'healthy',
        responseTime: Date.now() - startTime,
        message: `Docker ${dockerVersion}, ${composeVersion}`,
        details: {
          version: dockerVersion,
          composeVersion,
          runningContainers
        },
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      return {
        name: 'docker',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: `Docker check failed: ${error}`,
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Check Redis connection and health
   */
  async checkRedis(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      const { stdout } = await execAsync('docker exec a2r-redis redis-cli ping');
      
      if (stdout.trim() === 'PONG') {
        // Get Redis info
        const { stdout: infoOutput } = await execAsync('docker exec a2r-redis redis-cli info memory');
        const memoryInfo = this.parseRedisInfo(infoOutput);
        
        const usedMemory = parseInt(memoryInfo['used_memory'] || '0');
        const maxMemory = parseInt(memoryInfo['maxmemory'] || '536870912'); // 512MB default
        const memoryUsage = (usedMemory / maxMemory) * 100;

        let status: 'healthy' | 'degraded' = 'healthy';
        let message = 'Redis is responding';

        if (memoryUsage > 90) {
          status = 'degraded';
          message = `Redis memory usage high: ${memoryUsage.toFixed(1)}%`;
        }

        return {
          name: 'redis',
          status,
          responseTime: Date.now() - startTime,
          message,
          details: {
            memoryUsage: `${memoryUsage.toFixed(1)}%`,
            usedMemory: this.formatBytes(usedMemory),
            maxMemory: this.formatBytes(maxMemory)
          },
          lastChecked: new Date().toISOString()
        };
      } else {
        return {
          name: 'redis',
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          message: 'Redis did not respond with PONG',
          lastChecked: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        name: 'redis',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: `Redis check failed: ${error}`,
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Check disk space availability
   */
  async checkDiskSpace(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      // Check root partition
      const { stdout } = await execAsync("df -h / | awk 'NR==2{print $5,$2,$3,$4}'");
      const [usagePercent, total, used, available] = stdout.trim().split(' ');
      
      const usage = parseInt(usagePercent.replace('%', ''));
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = `Disk usage: ${usage}%`;

      if (usage > 90) {
        status = 'unhealthy';
        message = `Critical disk usage: ${usage}%`;
      } else if (usage > 80) {
        status = 'degraded';
        message = `High disk usage: ${usage}%`;
      }

      return {
        name: 'disk-space',
        status,
        responseTime: Date.now() - startTime,
        message,
        details: {
          usage: `${usage}%`,
          total,
          used,
          available
        },
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      return {
        name: 'disk-space',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: `Disk check failed: ${error}`,
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Check memory usage
   */
  async checkMemory(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      const { stdout } = await execAsync("free | awk 'NR==2{printf \"%.2f\", $3*100/$2}'");
      const usagePercent = parseFloat(stdout.trim());

      const { stdout: memInfo } = await execAsync("free -h | awk 'NR==2{print $2,$3,$7}'");
      const [total, used, available] = memInfo.trim().split(' ');

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = `Memory usage: ${usagePercent.toFixed(1)}%`;

      if (usagePercent > 95) {
        status = 'unhealthy';
        message = `Critical memory usage: ${usagePercent.toFixed(1)}%`;
      } else if (usagePercent > 85) {
        status = 'degraded';
        message = `High memory usage: ${usagePercent.toFixed(1)}%`;
      }

      return {
        name: 'memory',
        status,
        responseTime: Date.now() - startTime,
        message,
        details: {
          usage: `${usagePercent.toFixed(1)}%`,
          total,
          used,
          available
        },
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      return {
        name: 'memory',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: `Memory check failed: ${error}`,
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Check network connectivity
   */
  async checkNetwork(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      // Check network connections
      const { stdout: connCount } = await execAsync('netstat -an | grep ESTABLISHED | wc -l');
      const connections = parseInt(connCount.trim()) || 0;

      // Check external connectivity
      const pingResult = await execAsync('ping -c 1 -W 5 8.8.8.8 > /dev/null 2>&1 && echo "ok" || echo "fail"');
      const hasInternet = pingResult.stdout.trim() === 'ok';

      let status: 'healthy' | 'degraded' = 'healthy';
      let message = 'Network connectivity OK';

      if (!hasInternet) {
        status = 'degraded';
        message = 'No internet connectivity (working in offline mode)';
      }

      return {
        name: 'network',
        status,
        responseTime: Date.now() - startTime,
        message,
        details: {
          connections,
          hasInternet
        },
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      return {
        name: 'network',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: `Network check failed: ${error}`,
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Check configuration file validity
   */
  async checkConfig(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      const configData = await readFile(this.configPath, 'utf-8');
      const config = JSON.parse(configData);

      // Validate required fields
      const requiredFields = ['serverId', 'authToken', 'apiEndpoint'];
      const missingFields = requiredFields.filter(f => !config[f]);

      if (missingFields.length > 0) {
        return {
          name: 'config',
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          message: `Missing required fields: ${missingFields.join(', ')}`,
          lastChecked: new Date().toISOString()
        };
      }

      return {
        name: 'config',
        status: 'healthy',
        responseTime: Date.now() - startTime,
        message: 'Configuration is valid',
        details: {
          serverId: config.serverId,
          version: config.version
        },
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      return {
        name: 'config',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: `Configuration error: ${error}`,
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Check container dependencies
   */
  async checkDependencies(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      // Get all A2R containers
      const { stdout } = await execAsync(
        'docker ps --filter "name=a2r-" --format "{{.Names}}|{{.Status}}|{{.State}}"'
      );

      const containers = stdout.trim().split('\n').filter(Boolean).map(line => {
        const [name, status, state] = line.split('|');
        return { name, status, state };
      });

      const expectedContainers = ['a2r-agent', 'a2r-redis', 'a2r-traefik'];
      const runningContainers = containers.filter(c => c.state === 'running').map(c => c.name);
      const missingContainers = expectedContainers.filter(c => !runningContainers.includes(c));

      if (missingContainers.length === 0) {
        return {
          name: 'dependencies',
          status: 'healthy',
          responseTime: Date.now() - startTime,
          message: `All ${expectedContainers.length} containers are running`,
          details: {
            running: runningContainers,
            total: expectedContainers.length
          },
          lastChecked: new Date().toISOString()
        };
      } else {
        return {
          name: 'dependencies',
          status: 'degraded',
          responseTime: Date.now() - startTime,
          message: `Missing containers: ${missingContainers.join(', ')}`,
          details: {
            running: runningContainers,
            missing: missingContainers,
            total: expectedContainers.length
          },
          lastChecked: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        name: 'dependencies',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: `Dependency check failed: ${error}`,
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Get detailed system metrics
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      // CPU metrics
      const { stdout: cpuInfo } = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1");
      const { stdout: cpuCores } = await execAsync('nproc');
      const { stdout: loadAvg } = await execAsync("uptime | awk -F'load average:' '{print $2}'");

      // Memory metrics
      const { stdout: memInfo } = await execAsync("free | awk 'NR==2{print $2,$3,$4}'");
      const [memTotal, memUsed, memFree] = memInfo.trim().split(' ').map(Number);

      // Disk metrics
      const { stdout: diskInfo } = await execAsync("df / | awk 'NR==2{print $2,$3,$4}'");
      const [diskTotal, diskUsed, diskFree] = diskInfo.trim().split(' ').map(Number);

      // Network metrics
      const { stdout: netInfo } = await execAsync("cat /proc/net/dev | grep eth0 | awk '{print $2,$10}'");
      const [bytesIn, bytesOut] = netInfo.trim().split(' ').map(Number);
      const { stdout: connCount } = await execAsync('netstat -an | wc -l');

      return {
        cpu: {
          usage: parseFloat(cpuInfo.trim()) || 0,
          cores: parseInt(cpuCores.trim()) || 1,
          loadAverage: loadAvg.trim().split(',').map(s => parseFloat(s.trim()) || 0)
        },
        memory: {
          total: memTotal,
          used: memUsed,
          free: memFree,
          percentage: (memUsed / memTotal) * 100
        },
        disk: {
          total: diskTotal * 1024,
          used: diskUsed * 1024,
          free: diskFree * 1024,
          percentage: (diskUsed / diskTotal) * 100
        },
        network: {
          connections: parseInt(connCount.trim()) || 0,
          bytesIn: bytesIn || 0,
          bytesOut: bytesOut || 0
        }
      };
    } catch (error) {
      this.logger.error(`Failed to get system metrics: ${error}`);
      throw error;
    }
  }

  /**
   * Get information about running containers
   */
  async getContainerInfo(): Promise<DockerContainerInfo[]> {
    try {
      const { stdout } = await execAsync(
        'docker ps --filter "name=a2r-" --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.State}}"'
      );

      const lines = stdout.trim().split('\n').filter(Boolean);
      const containers: DockerContainerInfo[] = [];

      for (const line of lines) {
        const [id, name, image, status, state] = line.split('|');
        
        // Parse uptime from status
        const uptime = this.parseUptime(status);

        containers.push({
          id: id.substring(0, 12),
          name,
          image,
          status,
          health: state === 'running' ? 'healthy' : 'unhealthy',
          uptime
        });
      }

      return containers;
    } catch (error) {
      this.logger.error(`Failed to get container info: ${error}`);
      return [];
    }
  }

  // Helper methods

  private getCheckName(index: number): string {
    const names = [
      'agent-service',
      'docker',
      'redis',
      'disk-space',
      'memory',
      'network',
      'config',
      'dependencies'
    ];
    return names[index] || 'unknown';
  }

  private parseRedisInfo(info: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = info.split('\n');
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        result[key.trim()] = value.trim();
      }
    }
    
    return result;
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  private parseUptime(status: string): number {
    // Parse uptime from Docker status string like "Up 2 hours" or "Up 3 days"
    const match = status.match(/Up\s+(\d+)\s+(\w+)/);
    if (!match) return 0;

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    const multipliers: Record<string, number> = {
      'second': 1000,
      'seconds': 1000,
      'minute': 60 * 1000,
      'minutes': 60 * 1000,
      'hour': 60 * 60 * 1000,
      'hours': 60 * 60 * 1000,
      'day': 24 * 60 * 60 * 1000,
      'days': 24 * 60 * 60 * 1000
    };

    return value * (multipliers[unit] || 1000);
  }
}

// Export singleton instance
export const healthChecker = new HealthChecker();

// HTTP handler for health endpoint
export async function healthHandler(_req?: any, res?: any): Promise<HealthCheckResult> {
  const result = await healthChecker.checkHealth();
  
  if (res) {
    const statusCode = result.status === 'healthy' ? 200 : 
                       result.status === 'degraded' ? 200 : 503;
    res.status(statusCode).json(result);
  }
  
  return result;
}

// Readiness probe handler
export async function readinessHandler(_req?: any, res?: any): Promise<{ ready: boolean }> {
  const health = await healthChecker.checkHealth();
  const ready = health.status !== 'unhealthy' && 
                health.checks.some(c => c.name === 'agent-service' && c.status === 'healthy');
  
  const result = { ready };
  
  if (res) {
    res.status(ready ? 200 : 503).json(result);
  }
  
  return result;
}

// Liveness probe handler
export async function livenessHandler(_req?: any, res?: any): Promise<{ alive: boolean }> {
  const result = { alive: true };
  
  if (res) {
    res.status(200).json(result);
  }
  
  return result;
}
