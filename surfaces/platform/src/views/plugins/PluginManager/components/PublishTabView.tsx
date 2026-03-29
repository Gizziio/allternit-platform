import React from 'react';
import { 
  FilePlus, 
  Shield, 
  UploadSimple, 
  FileCode, 
  GitBranch, 
  CaretRight 
} from '@phosphor-icons/react';
import { THEME } from '../constants';
import type { FileSystemAPI } from '../../../../plugins/fileSystem';

interface PublishTabViewProps {
  fs: FileSystemAPI;
  onOpenCreateModal: () => void;
  onOpenValidateModal: () => void;
  onOpenSubmitModal: () => void;
}

export function PublishTabView({ fs, onOpenCreateModal, onOpenValidateModal, onOpenSubmitModal }: PublishTabViewProps) {
  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header Section */}
      <div
        style={{
          padding: 24,
          borderRadius: 12,
          border: `1px solid ${THEME.border}`,
          backgroundColor: 'rgba(255,255,255,0.02)',
          marginBottom: 24,
        }}
      >
        <h2 style={{ margin: '0 0 8px 0', fontSize: 22, color: THEME.textPrimary, fontWeight: 600 }}>
          Publish Your Plugin to A2R Marketplace
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: THEME.textSecondary, lineHeight: 1.6 }}>
          Share your plugins with the A2R community. The publishing process involves creating a plugin from a template,
          validating your manifest, and submitting to the marketplace for review.
        </p>
      </div>

      {/* Action Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {/* Card 1: Create New Plugin */}
        <PublishActionCard
          icon={<FilePlus size={28} color={THEME.accent} />}
          title="Create New Plugin"
          description="Start with a template. Choose from Command, Skill, MCP, WebhooksLogo, or Full Plugin types. Generates plugin.json and starter files."
          buttonText="Create from Template"
          onClick={onOpenCreateModal}
          accentColor={THEME.accent}
        />

        {/* Card 2: Validate Plugin */}
        <PublishActionCard
          icon={<Shield size={28} color="#22c55e" />}
          title="Validate Plugin"
          description="Validate your plugin.json against the A2R schema. Check for required fields, proper formatting, and best practices before submitting."
          buttonText="Validate Now"
          onClick={onOpenValidateModal}
          accentColor="#22c55e"
        />

        {/* Card 3: Submit to Marketplace */}
        <PublishActionCard
          icon={<UploadSimple size={28} color="#60a5fa" />}
          title="Submit to Marketplace"
          description="Submit your plugin for review. Provide your GitHub repo URL, select a category, and add a description. Your submission will be saved locally."
          buttonText="Submit Plugin"
          onClick={onOpenSubmitModal}
          accentColor="#60a5fa"
        />
      </div>

      {/* Publishing Workflow Guide */}
      <div
        style={{
          marginTop: 32,
          padding: 24,
          borderRadius: 12,
          border: `1px solid ${THEME.border}`,
          backgroundColor: THEME.bgElevated,
        }}
      >
        <h3 style={{ margin: '0 0 20px 0', fontSize: 16, color: THEME.textPrimary, fontWeight: 600 }}>
          Publishing Workflow
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <WorkflowStep
            number={1}
            title="Create Your Plugin"
            description="Use the 'Create from Template' wizard to generate starter files in your chosen directory."
            icon={<FileCode size={16} />}
          />
          <WorkflowStep
            number={2}
            title="Validate Your Manifest"
            description="Run the validator to ensure your plugin.json follows the correct A2R schema."
            icon={<Shield size={16} />}
          />
          <WorkflowStep
            number={3}
            title="Push to GitHub"
            description="Create a public GitHub repository with your plugin files and a README."
            icon={<GitBranch size={16} />}
          />
          <WorkflowStep
            number={4}
            title="Submit to Marketplace"
            description="Use the submit form to add your plugin to the marketplace index for review."
            icon={<UploadSimple size={16} />}
          />
        </div>
      </div>
    </div>
  );
}

function PublishActionCard({
  icon,
  title,
  description,
  buttonText,
  onClick,
  accentColor,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonText: string;
  onClick: () => void;
  accentColor: string;
}) {
  return (
    <div
      style={{
        padding: 24,
        borderRadius: 12,
        border: `1px solid ${THEME.border}`,
        backgroundColor: THEME.bgElevated,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 12,
          backgroundColor: `${accentColor}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </div>
      <div>
        <h3 style={{ margin: '0 0 8px 0', fontSize: 16, color: THEME.textPrimary, fontWeight: 600 }}>
          {title}
        </h3>
        <p style={{ margin: 0, fontSize: 13, color: THEME.textSecondary, lineHeight: 1.5 }}>
          {description}
        </p>
      </div>
      <div style={{ marginTop: 'auto', paddingTop: 8 }}>
        <button
          onClick={onClick}
          style={{
            padding: '10px 18px',
            borderRadius: 8,
            border: `1px solid ${accentColor}40`,
            backgroundColor: `${accentColor}15`,
            color: accentColor,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `${accentColor}25`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = `${accentColor}15`;
          }}
        >
          {buttonText}
          <CaretRight size={14} />
        </button>
      </div>
    </div>
  );
}

function WorkflowStep({
  number,
  title,
  description,
  icon,
}: {
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: THEME.accentMuted,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: THEME.accent,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: THEME.textPrimary, marginBottom: 2 }}>
          {number}. {title}
        </div>
        <p style={{ margin: 0, fontSize: 12, color: THEME.textSecondary, lineHeight: 1.5 }}>
          {description}
        </p>
      </div>
    </div>
  );
}
