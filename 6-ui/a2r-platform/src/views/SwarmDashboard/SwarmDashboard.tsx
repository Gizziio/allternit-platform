/**
 * Swarm Dashboard Component
 * 
 * Displays swarm advanced features:
 * - Circuit breaker status
 * - Quarantined agents
 * - Message statistics
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  ShieldAlert,
  MessageSquare
} from 'lucide-react';

// API base URL from environment or default
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1/swarm';

interface CircuitBreakerStatus {
  agent_id: string;
  state: 'closed' | 'open' | 'half_open';
  failure_count: number;
  success_count: number;
  last_failure_at?: string;
  last_state_change?: string;
}

interface QuarantinedAgentStatus {
  agent_id: string;
  quarantined_at: string;
  expires_at: string;
  reason: string;
  remaining_minutes: number;
}

interface MessageStats {
  messages_sent: number;
  messages_received: number;
  messages_failed: number;
  avg_latency_ms: number;
  active_streams: number;
}

export function SwarmDashboard() {
  const [circuitBreakers, setCircuitBreakers] = useState<CircuitBreakerStatus[]>([]);
  const [quarantined, setQuarantined] = useState<QuarantinedAgentStatus[]>([]);
  const [messageStats, setMessageStats] = useState<MessageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all data
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [cbRes, qRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/circuit-breakers`),
        fetch(`${API_BASE}/quarantine`),
        fetch(`${API_BASE}/messages/stats`),
      ]);
      
      if (!cbRes.ok || !qRes.ok || !statsRes.ok) {
        throw new Error('Failed to fetch swarm data');
      }
      
      const cbData = await cbRes.json();
      const qData = await qRes.json();
      const statsData = await statsRes.json();
      
      setCircuitBreakers(Array.isArray(cbData) ? cbData : []);
      setQuarantined(Array.isArray(qData) ? qData : []);
      setMessageStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Reset circuit breaker
  const resetCircuitBreaker = async (agentId: string) => {
    try {
      const res = await fetch(`${API_BASE}/circuit-breakers/${agentId}/reset`, {
        method: 'POST',
      });
      
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Failed to reset circuit breaker:', err);
    }
  };

  // Release from quarantine
  const releaseFromQuarantine = async (agentId: string) => {
    try {
      const res = await fetch(`${API_BASE}/quarantine/${agentId}/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId }),
      });
      
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Failed to release from quarantine:', err);
    }
  };

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Get circuit breaker badge color
  const getCircuitBreakerBadge = (state: string) => {
    switch (state) {
      case 'closed':
        return <Badge className="bg-green-500">Closed</Badge>;
      case 'open':
        return <Badge className="bg-red-500">Open</Badge>;
      case 'half_open':
        return <Badge className="bg-yellow-500">Half Open</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" role="img" aria-label="Loading" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-500">{error}</p>
          <Button onClick={fetchData} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Swarm Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and manage swarm advanced features
          </p>
        </div>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Circuit Breakers
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{circuitBreakers?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {(circuitBreakers ?? []).filter(cb => cb.state === 'open').length} open
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Quarantined Agents
            </CardTitle>
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{quarantined?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              Agents isolated
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Messages Sent
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(messageStats?.messages_sent ?? 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {(messageStats?.messages_received ?? 0).toLocaleString()} received
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg Latency
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(messageStats?.avg_latency_ms ?? 0).toFixed(2)}ms
            </div>
            <p className="text-xs text-muted-foreground">
              {(messageStats?.messages_failed ?? 0).toLocaleString()} failed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="circuit-breakers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="circuit-breakers">
            Circuit Breakers
          </TabsTrigger>
          <TabsTrigger value="quarantine">
            Quarantine
          </TabsTrigger>
          <TabsTrigger value="stats">
            Statistics
          </TabsTrigger>
        </TabsList>

        {/* Circuit Breakers Tab */}
        <TabsContent value="circuit-breakers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Circuit Breaker Status</CardTitle>
            </CardHeader>
            <CardContent>
              {circuitBreakers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>No circuit breakers active</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent ID</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Failures</TableHead>
                      <TableHead>Successes</TableHead>
                      <TableHead>Last Failure</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {circuitBreakers.map((cb) => (
                      <TableRow key={cb.agent_id}>
                        <TableCell className="font-mono text-sm">
                          {cb.agent_id}
                        </TableCell>
                        <TableCell>
                          {getCircuitBreakerBadge(cb.state)}
                        </TableCell>
                        <TableCell>{cb.failure_count}</TableCell>
                        <TableCell>{cb.success_count}</TableCell>
                        <TableCell>
                          {cb.last_failure_at 
                            ? new Date(cb.last_failure_at).toLocaleString()
                            : 'Never'
                          }
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => resetCircuitBreaker(cb.agent_id)}
                            disabled={cb.state === 'closed'}
                          >
                            Reset
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quarantine Tab */}
        <TabsContent value="quarantine" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quarantined Agents</CardTitle>
            </CardHeader>
            <CardContent>
              {quarantined.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>No agents in quarantine</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent ID</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Quarantined At</TableHead>
                      <TableHead>Expires At</TableHead>
                      <TableHead>Remaining</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quarantined.map((agent) => (
                      <TableRow key={agent.agent_id}>
                        <TableCell className="font-mono text-sm">
                          {agent.agent_id}
                        </TableCell>
                        <TableCell>{agent.reason}</TableCell>
                        <TableCell>
                          {new Date(agent.quarantined_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {new Date(agent.expires_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={agent.remaining_minutes > 0 ? 'default' : 'destructive'}>
                            {agent.remaining_minutes > 0 
                              ? `${agent.remaining_minutes}m`
                              : 'Expired'
                            }
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => releaseFromQuarantine(agent.agent_id)}
                          >
                            Release
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Statistics Tab */}
        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Message Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="text-sm font-medium mb-2">Messages</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sent</span>
                      <span className="font-mono">
                        {(messageStats?.messages_sent ?? 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Received</span>
                      <span className="font-mono">
                        {(messageStats?.messages_received ?? 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Failed</span>
                      <span className="font-mono text-red-500">
                        {(messageStats?.messages_failed ?? 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Performance</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg Latency</span>
                      <span className="font-mono">
                        {(messageStats?.avg_latency_ms ?? 0).toFixed(2)}ms
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Active Streams</span>
                      <span className="font-mono">
                        {messageStats?.active_streams ?? 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Success Rate</span>
                      <span className="font-mono text-green-500">
                        {messageStats && messageStats.messages_sent > 0
                          ? ((messageStats.messages_received / messageStats.messages_sent) * 100).toFixed(1)
                          : 100
                        }%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default SwarmDashboard;
