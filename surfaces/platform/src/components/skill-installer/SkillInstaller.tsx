/**
 * Skill Installer UI - OC-015
 *
 * Native React component for installing and managing skills in A2R.
 * This component provides the UI for the skill installation functionality
 * that will eventually replace OpenClaw's skill installation UI.
 */

import React, { useState, useEffect } from 'react';
import { Button, Card, Table, Tag, Space, Input, Select, Modal, Progress, Alert } from 'antd';
import { DownloadOutlined, UploadOutlined, SearchOutlined, CheckCircleOutlined, CloseCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { SkillInstallerApiService } from '@/services/SkillInstallerApiService';

const { Column } = Table;

// Types for skill data
export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  status: 'installed' | 'available' | 'installing' | 'error';
  installedVersion?: string;
  category: string;
  tags: string[];
  requires: string[];
  source: 'a2r-registry' | 'openclaw-registry' | 'local' | 'remote';
  downloadUrl?: string;
  license: string;
  lastUpdated: string;
}

// Types for installation response
export interface InstallationResponse {
  success: boolean;
  message: string;
  skillId: string;
  error?: string;
}

// Props for the SkillInstaller component
interface SkillInstallerProps {
  // Optional callback when a skill is installed
  onSkillInstalled?: (skill: Skill) => void;
  // Optional callback when a skill is uninstalled
  onSkillUninstalled?: (skillId: string) => void;
  // Optional API endpoint for skill operations
  apiEndpoint?: string;
  // Whether to show the installer in a modal
  showModal?: boolean;
  // Callback to close the modal
  onCloseModal?: () => void;
}

// Main SkillInstaller component
const SkillInstaller: React.FC<SkillInstallerProps> = ({
  onSkillInstalled,
  onSkillUninstalled,
  apiEndpoint = '/api/skills',
  showModal = false,
  onCloseModal
}) => {
  // State for skills data
  const [skills, setSkills] = useState<Skill[]>([]);
  // State for loading
  const [loading, setLoading] = useState<boolean>(true);
  // State for search term
  const [searchTerm, setSearchTerm] = useState<string>('');
  // State for selected category filter
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  // State for installation progress
  const [installationProgress, setInstallationProgress] = useState<Record<string, number>>({});
  // State for installation status
  const [installationStatus, setInstallationStatus] = useState<Record<string, 'idle' | 'installing' | 'success' | 'error'>>({});
  // State for error messages
  const [error, setError] = useState<string | null>(null);
  // State for selected skill to install
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  // State for installation modal visibility
  const [installModalVisible, setInstallModalVisible] = useState<boolean>(false);

  const skillApi = React.useMemo(() => new SkillInstallerApiService(apiEndpoint), [apiEndpoint]);

  // Fetch skills from API
  useEffect(() => {
    setLoading(true);
    setError(null);
    skillApi.listSkills()
      .then(({ skills: fetched }) => {
        setSkills(fetched);
        const initialStatus: Record<string, 'idle' | 'installing' | 'success' | 'error'> = {};
        fetched.forEach(skill => { initialStatus[skill.id] = 'idle'; });
        setInstallationStatus(initialStatus);
      })
      .catch(err => setError('Failed to load skills: ' + (err as Error).message))
      .finally(() => setLoading(false));
  }, [skillApi]);

  // Filter skills based on search and category
  const filteredSkills = skills.filter(skill => {
    const matchesSearch = skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          skill.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          skill.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || skill.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Get unique categories for the filter dropdown
  const categories = ['all', ...Array.from(new Set(skills.map(skill => skill.category)))];

  // Handle skill installation
  const handleInstallSkill = async (skill: Skill) => {
    if (skill.status === 'installed') {
      return; // Already installed
    }

    setInstallationStatus(prev => ({ ...prev, [skill.id]: 'installing' }));
    setInstallationProgress(prev => ({ ...prev, [skill.id]: 0 }));
    try {
      const response = await skillApi.installSkill({ skillId: skill.id, version: skill.version });
      if (response.success) {
        setSkills(prev => prev.map(s =>
          s.id === skill.id ? { ...s, status: 'installed', installedVersion: s.version } : s
        ));
        setInstallationStatus(prev => ({ ...prev, [skill.id]: 'success' }));
        setInstallationProgress(prev => ({ ...prev, [skill.id]: 100 }));
        if (onSkillInstalled) {
          onSkillInstalled({ ...skill, status: 'installed', installedVersion: skill.version });
        }
      } else {
        setInstallationStatus(prev => ({ ...prev, [skill.id]: 'error' }));
        setError(response.error || `Failed to install ${skill.name}`);
      }
    } catch (err) {
      setInstallationStatus(prev => ({ ...prev, [skill.id]: 'error' }));
      setError('Installation failed: ' + (err as Error).message);
    }
  };

  // Handle skill uninstallation
  const handleUninstallSkill = async (skillId: string) => {
    try {
      await skillApi.uninstallSkill({ skillId });
      setSkills(prev => prev.map(s =>
        s.id === skillId ? { ...s, status: 'available', installedVersion: undefined } : s
      ));
      setInstallationStatus(prev => ({ ...prev, [skillId]: 'idle' }));
      if (onSkillUninstalled) {
        onSkillUninstalled(skillId);
      }
    } catch (err) {
      setError('Uninstallation failed: ' + (err as Error).message);
    }
  };

  // Handle skill selection for detailed view
  const handleSelectSkill = (skill: Skill) => {
    setSelectedSkill(skill);
    setInstallModalVisible(true);
  };

  // Close the installation modal
  const handleCloseInstallModal = () => {
    setInstallModalVisible(false);
    setSelectedSkill(null);
  };

  // Render the component
  return (
    <div className="skill-installer">
      <Card 
        title={
          <Space>
            <span>Skill Installer</span>
            <Tag color="blue">Native</Tag>
          </Space>
        }
        extra={
          <Space>
            <Select
              defaultValue="all"
              style={{ width: 150 }}
              onChange={setSelectedCategory}
              options={categories.map(cat => ({ label: cat.charAt(0).toUpperCase() + cat.slice(1), value: cat }))}
            />
            <Input
              placeholder="Search skills..."
              prefix={<SearchOutlined />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: 200 }}
            />
          </Space>
        }
      >
        {error && (
          <Alert
            message="Error"
            description={error}
            type="error"
            closable
            onClose={() => setError(null)}
            style={{ marginBottom: 16 }}
          />
        )}

        <Table
          dataSource={filteredSkills}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        >
          <Column
            title="Name"
            dataIndex="name"
            key="name"
            render={(name, record) => (
              <a onClick={() => handleSelectSkill(record as Skill)}>{name}</a>
            )}
          />
          <Column
            title="Description"
            dataIndex="description"
            key="description"
          />
          <Column
            title="Version"
            dataIndex="version"
            key="version"
            render={(version, record) => (
              <span>
                {(record as Skill).installedVersion ? `${(record as Skill).installedVersion} (installed)` : version}
              </span>
            )}
          />
          <Column
            title="Category"
            dataIndex="category"
            key="category"
            render={(category) => (
              <Tag color="default">{category}</Tag>
            )}
          />
          <Column
            title="Status"
            key="status"
            render={(_, record) => {
              const status = installationStatus[record.id];
              
              if (status === 'installing') {
                return (
                  <Space>
                    <span>Installing</span>
                    <Progress 
                      type="circle" 
                      percent={installationProgress[record.id] || 0} 
                      size={20} 
                      strokeWidth={4} 
                    />
                  </Space>
                );
              }
              
              if (status === 'success') {
                return (
                  <Space>
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    <span>Installed</span>
                  </Space>
                );
              }
              
              if (status === 'error') {
                return (
                  <Space>
                    <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                    <span>Error</span>
                  </Space>
                );
              }
              
              return (
                <Tag 
                  color={
                    record.status === 'installed' ? 'green' : 
                    record.source === 'a2r-registry' ? 'blue' : 
                    record.source === 'openclaw-registry' ? 'orange' : 'default'
                  }
                >
                  {record.status === 'installed' ? 'Installed' : 'Available'}
                </Tag>
              );
            }}
          />
          <Column
            title="Source"
            key="source"
            render={(_, record) => (
              <Tag 
                color={
                  record.source === 'a2r-registry' ? 'blue' : 
                  record.source === 'openclaw-registry' ? 'orange' : 
                  record.source === 'local' ? 'green' : 'default'
                }
              >
                {record.source === 'a2r-registry' ? 'A2R Registry' : 
                 record.source === 'openclaw-registry' ? 'OpenClaw' : 
                 record.source === 'local' ? 'Local' : 'Remote'}
              </Tag>
            )}
          />
          <Column
            title="Actions"
            key="actions"
            render={(_, record) => {
              const skill = record as Skill;
              return (
                <Space size="middle">
                  {skill.status !== 'installed' ? (
                    <Button
                      type="primary"
                      icon={<DownloadOutlined />}
                      disabled={installationStatus[skill.id] === 'installing'}
                      onClick={() => handleInstallSkill(skill)}
                    >
                      {installationStatus[skill.id] === 'installing' ? 'Installing...' : 'Install'}
                    </Button>
                  ) : (
                    <Button
                      danger
                      icon={<UploadOutlined />}
                      onClick={() => handleUninstallSkill(skill.id)}
                    >
                      Uninstall
                    </Button>
                  )}
                </Space>
              );
            }}
          />
        </Table>
      </Card>

      {/* Skill Detail Modal */}
      <Modal
        title={selectedSkill?.name}
        open={installModalVisible}
        onCancel={handleCloseInstallModal}
        footer={[
          <Button key="cancel" onClick={handleCloseInstallModal}>Cancel</Button>,
          selectedSkill?.status !== 'installed' && (
            <Button
              key="install"
              type="primary"
              icon={<DownloadOutlined />}
              disabled={installationStatus[selectedSkill?.id || ''] === 'installing'}
              onClick={() => {
                if (selectedSkill) {
                  handleInstallSkill(selectedSkill);
                  handleCloseInstallModal();
                }
              }}
            >
              {installationStatus[selectedSkill?.id || ''] === 'installing' ? 'Installing...' : 'Install'}
            </Button>
          )
        ].filter(Boolean)}
      >
        {selectedSkill && (
          <div>
            <p><strong>Description:</strong> {selectedSkill.description}</p>
            <p><strong>Author:</strong> {selectedSkill.author}</p>
            <p><strong>Version:</strong> {selectedSkill.version}</p>
            <p><strong>License:</strong> {selectedSkill.license}</p>
            <p><strong>Last Updated:</strong> {selectedSkill.lastUpdated}</p>
            <p><strong>Category:</strong> {selectedSkill.category}</p>
            <p><strong>Tags:</strong> {selectedSkill.tags.join(', ')}</p>
            <p><strong>Requires:</strong> {selectedSkill.requires.join(', ')}</p>
            <p><strong>Source:</strong> {selectedSkill.source}</p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SkillInstaller;