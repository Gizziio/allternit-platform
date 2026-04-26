#!/usr/bin/env python3
"""
Allternit Resource Monitor Service
Monitors agent containers and enforces resource limits
"""

import os
import sys
import time
import json
import logging
import signal
from datetime import datetime
from typing import Dict, Optional

import docker
import psutil
import yaml

# Configuration
DOCKER_SOCKET = os.getenv('DOCKER_SOCKET', 'unix:///var/run/docker.sock')
MONITOR_INTERVAL = int(os.getenv('MONITOR_INTERVAL', '10'))
AGENT_ID = os.getenv('AGENT_ID', 'default')
MAX_CPU = float(os.getenv('MAX_CPU', '2'))
MAX_MEMORY = os.getenv('MAX_MEMORY', '4G')
KILL_ON_VIOLATION = os.getenv('KILL_ON_VIOLATION', 'true').lower() == 'true'

# Logging setup
logging.basicConfig(
    level=getattr(logging, os.getenv('LOG_LEVEL', 'INFO')),
    format='%(asctime)s [%(levelname)s] [monitor] %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger('allternit-monitor')

class ResourceMonitor:
    def __init__(self):
        self.client: Optional[docker.DockerClient] = None
        self.container = None
        self.running = True
        self.stats_history = []
        
    def connect(self) -> bool:
        """Connect to Docker daemon"""
        try:
            self.client = docker.DockerClient(base_url=DOCKER_SOCKET)
            logger.info(f"Connected to Docker: {self.client.version()['Version']}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to Docker: {e}")
            return False
    
    def find_agent_container(self) -> Optional[docker.models.containers.Container]:
        """Find the agent container to monitor"""
        try:
            container_name = f"allternit-agent-{AGENT_ID}"
            try:
                return self.client.containers.get(container_name)
            except docker.errors.NotFound:
                # Try to find by label
                containers = self.client.containers.list(
                    filters={'label': f'allternit.agent.id={AGENT_ID}'}
                )
                return containers[0] if containers else None
        except Exception as e:
            logger.error(f"Error finding container: {e}")
            return None
    
    def parse_memory(self, memory_str: str) -> int:
        """Parse memory string to bytes"""
        units = {'B': 1, 'K': 1024, 'M': 1024**2, 'G': 1024**3, 'T': 1024**4}
        memory_str = memory_str.upper().strip()
        
        for unit, multiplier in units.items():
            if memory_str.endswith(unit):
                return int(float(memory_str[:-1]) * multiplier)
        
        return int(memory_str)
    
    def get_container_stats(self, container) -> Dict:
        """Get container resource statistics"""
        try:
            stats = container.stats(stream=False)
            
            # Calculate CPU usage
            cpu_delta = (
                stats['cpu_stats']['cpu_usage']['total_usage'] -
                stats['precpu_stats']['cpu_usage']['total_usage']
            )
            system_delta = (
                stats['cpu_stats']['system_cpu_usage'] -
                stats['precpu_stats']['system_cpu_usage']
            )
            
            cpu_percent = 0.0
            if system_delta > 0 and cpu_delta > 0:
                cpu_percent = (cpu_delta / system_delta) * len(stats['cpu_stats']['cpu_usage'].get('percpu_usage', [1])) * 100
            
            # Memory usage
            memory_stats = stats.get('memory_stats', {})
            memory_usage = memory_stats.get('usage', 0)
            memory_limit = memory_stats.get('limit', 1)
            memory_percent = (memory_usage / memory_limit) * 100 if memory_limit > 0 else 0
            
            # Network I/O
            networks = stats.get('networks', {})
            net_rx = sum(n.get('rx_bytes', 0) for n in networks.values())
            net_tx = sum(n.get('tx_bytes', 0) for n in networks.values())
            
            return {
                'timestamp': datetime.utcnow().isoformat(),
                'cpu_percent': round(cpu_percent, 2),
                'memory_usage_bytes': memory_usage,
                'memory_limit_bytes': memory_limit,
                'memory_percent': round(memory_percent, 2),
                'network_rx_bytes': net_rx,
                'network_tx_bytes': net_tx,
                'pids': stats.get('pids_stats', {}).get('current', 0),
                'container_id': container.id[:12]
            }
        except Exception as e:
            logger.error(f"Error getting stats: {e}")
            return {}
    
    def check_limits(self, stats: Dict) -> list:
        """Check if resource usage exceeds limits"""
        violations = []
        
        # Check CPU
        if stats.get('cpu_percent', 0) > (MAX_CPU * 100):
            violations.append({
                'resource': 'cpu',
                'current': stats['cpu_percent'],
                'limit': MAX_CPU * 100,
                'severity': 'warning'
            })
        
        # Check memory
        max_memory_bytes = self.parse_memory(MAX_MEMORY)
        if stats.get('memory_usage_bytes', 0) > max_memory_bytes:
            violations.append({
                'resource': 'memory',
                'current': stats['memory_usage_bytes'],
                'limit': max_memory_bytes,
                'severity': 'critical'
            })
        
        return violations
    
    def handle_violations(self, container, violations: list):
        """Handle resource limit violations"""
        for violation in violations:
            logger.warning(
                f"Resource violation: {violation['resource']} - "
                f"Current: {violation['current']}, Limit: {violation['limit']}"
            )
            
            if violation['severity'] == 'critical' and KILL_ON_VIOLATION:
                logger.error(f"Critical violation! Stopping container {container.name}")
                try:
                    container.stop(timeout=30)
                    logger.info(f"Container {container.name} stopped")
                except Exception as e:
                    logger.error(f"Failed to stop container: {e}")
    
    def run(self):
        """Main monitoring loop"""
        if not self.connect():
            sys.exit(1)
        
        logger.info(f"Starting resource monitor for agent: {AGENT_ID}")
        logger.info(f"Limits: CPU={MAX_CPU}, Memory={MAX_MEMORY}")
        
        while self.running:
            try:
                # Find container if not already monitoring
                if not self.container:
                    self.container = self.find_agent_container()
                    if self.container:
                        logger.info(f"Monitoring container: {self.container.name}")
                    else:
                        logger.debug("Container not found, waiting...")
                        time.sleep(MONITOR_INTERVAL)
                        continue
                
                # Get stats
                stats = self.get_container_stats(self.container)
                if stats:
                    self.stats_history.append(stats)
                    
                    # Keep only last 100 measurements
                    if len(self.stats_history) > 100:
                        self.stats_history.pop(0)
                    
                    # Check limits
                    violations = self.check_limits(stats)
                    if violations:
                        self.handle_violations(self.container, violations)
                    
                    # Log stats periodically
                    if len(self.stats_history) % 6 == 0:  # Every minute
                        logger.info(
                            f"Stats - CPU: {stats['cpu_percent']}%, "
                            f"Memory: {stats['memory_percent']}% "
                            f"({stats['memory_usage_bytes'] / 1024 / 1024:.1f}MB)"
                        )
                
                # Check if container is still running
                try:
                    self.container.reload()
                    if self.container.status != 'running':
                        logger.info(f"Container {self.container.name} is {self.container.status}")
                        self.container = None
                except Exception:
                    logger.info("Container no longer exists")
                    self.container = None
                
                time.sleep(MONITOR_INTERVAL)
                
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                time.sleep(MONITOR_INTERVAL)
    
    def stop(self):
        """Stop the monitor"""
        logger.info("Stopping monitor...")
        self.running = False

def main():
    monitor = ResourceMonitor()
    
    def signal_handler(signum, frame):
        monitor.stop()
    
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    
    monitor.run()

if __name__ == '__main__':
    main()
