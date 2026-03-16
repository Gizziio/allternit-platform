/**
 * Cloud Deploy Page
 * 
 * Wrapper for the cloud deployment wizard in ShellUI.
 */

import React from 'react';
import { CloudDeployView } from '@/views/cloud-deploy/CloudDeployView';
import './CloudDeployPage.css';

export const CloudDeployPage: React.FC = () => {
  return (
    <div className="cloud-deploy-page">
      <CloudDeployView />
    </div>
  );
};

export default CloudDeployPage;
