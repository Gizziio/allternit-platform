/**
 * Instances Page
 * 
 * Core control surface for instance management.
 * Table view with drill-down capability.
 */

import React from 'react';

export const InstancesPage: React.FC = () => {
  return (
    <div className="instances-page">
      <div className="page-header">
        <h1 className="page-title">Instances</h1>
        <button className="btn-primary">+ New Instance</button>
      </div>
      
      <table className="instances-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Provider</th>
            <th>Status</th>
            <th>CPU</th>
            <th>RAM</th>
            <th>Agents</th>
            <th>Cost/hr</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={8} className="empty-state">
              No instances deployed. Click "New Instance" to deploy.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default InstancesPage;
