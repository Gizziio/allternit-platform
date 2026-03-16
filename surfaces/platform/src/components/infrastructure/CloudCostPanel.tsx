/**
 * CloudCostPanel.tsx
 * 
 * Component for displaying and managing cloud infrastructure costs.
 */

import React, { useState, useEffect } from 'react';
import {
  cloudApi,
  type CloudProvider,
  type Instance,
  type Deployment,
} from '@/api/infrastructure/cloud';

export interface CloudCostPanelProps {
  providerId?: string;
  showDeployments?: boolean;
  showInstances?: boolean;
}

interface CostEstimate {
  hourly: number;
  daily: number;
  monthly: number;
}

export function CloudCostPanel({
  providerId,
  showDeployments = true,
  showInstances = true,
}: CloudCostPanelProps) {
  const [providers, setProviders] = useState<CloudProvider[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [costEstimate, setCostEstimate] = useState<CostEstimate>({
    hourly: 0,
    daily: 0,
    monthly: 0,
  });

  useEffect(() => {
    loadData();
  }, [providerId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [providersData, instancesData, deploymentsData] = await Promise.all([
        cloudApi.listProviders(),
        cloudApi.listInstances(),
        cloudApi.listDeployments(),
      ]);

      setProviders(providersData);
      setInstances(instancesData);
      setDeployments(deploymentsData);

      // Calculate cost estimate
      const hourly = instancesData.reduce((sum, inst) => sum + (inst.cost_hr || 0), 0);
      setCostEstimate({
        hourly,
        daily: hourly * 24,
        monthly: hourly * 24 * 30,
      });
    } catch (error) {
      console.error('Failed to load cloud cost data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading cost data...</div>;
  }

  return (
    <div className="cloud-cost-panel">
      <h2>Cloud Cost Overview</h2>
      
      <div className="cost-summary">
        <div className="cost-card">
          <span className="cost-label">Hourly</span>
          <span className="cost-value">${costEstimate.hourly.toFixed(4)}</span>
        </div>
        <div className="cost-card">
          <span className="cost-label">Daily</span>
          <span className="cost-value">${costEstimate.daily.toFixed(2)}</span>
        </div>
        <div className="cost-card">
          <span className="cost-label">Monthly</span>
          <span className="cost-value">${costEstimate.monthly.toFixed(2)}</span>
        </div>
      </div>

      {showInstances && (
        <div className="instances-section">
          <h3>Running Instances ({instances.length})</h3>
          {instances.length === 0 ? (
            <p>No active instances</p>
          ) : (
            <ul>
              {instances.map((instance) => (
                <li key={instance.id}>
                  {instance.name} - {instance.provider} - ${instance.cost_hr}/hr
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showDeployments && (
        <div className="deployments-section">
          <h3>Recent Deployments ({deployments.length})</h3>
          {deployments.length === 0 ? (
            <p>No recent deployments</p>
          ) : (
            <ul>
              {deployments.map((deployment) => (
                <li key={deployment.id}>
                  {deployment.instance_name} - {deployment.status}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="providers-section">
        <h3>Available Providers ({providers.length})</h3>
        <ul>
          {providers.map((provider) => (
            <li key={provider.id}>
              {provider.name} - Starting at {provider.currency}{provider.starting_price}/{provider.period}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default CloudCostPanel;
