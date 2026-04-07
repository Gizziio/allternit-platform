/**
 * School Platform Integrations
 * 
 * Integrations for actual platforms used by Summit OIC:
 * - CompTIA (certifications)
 * - Microsoft Office (Word, Excel, PowerPoint)
 * - VMware (virtual labs)
 * - Cisco Packet Tracer (networking)
 * 
 * @module summit.canvas.integrations
 */

// ============================================================================
// CompTIA Integration
// ============================================================================

export interface CompTIAIntegration {
  /**
   * Link assignment to CompTIA certification objectives
   */
  linkToCertification(assignmentId: string, certificationId: string, objectives: string[]): Promise<void>;
  
  /**
   * Get CompTIA exam objectives
   */
  getExamObjectives(certificationId: string): Promise<CompTIAObjective[]>;
  
  /**
   * Track student certification progress
   */
  trackProgress(studentId: string, certificationId: string): Promise<CompTIAProgress>;
  
  /**
   * Generate practice quiz from exam objectives
   */
  generatePracticeQuiz(objectives: string[]): Promise<QuizTemplate>;
}

export interface CompTIAObjective {
  id: string;
  code: string;  // e.g., "1.1", "2.3"
  description: string;
  domain: string;
}

export interface CompTIAProgress {
  studentId: string;
  certificationId: string;
  completedObjectives: string[];
  totalObjectives: number;
  percentComplete: number;
  estimatedExamReady: boolean;
}

export interface QuizTemplate {
  title: string;
  questions: QuizQuestion[];
  passingScore: number;
}

export interface QuizQuestion {
  question: string;
  type: 'multiple_choice' | 'true_false' | 'drag_drop';
  options?: string[];
  correctAnswer: string | string[];
  explanation: string;
  objectiveCode: string;
}

// ============================================================================
// Microsoft Office Integration
// ============================================================================

export interface MSOfficeIntegration {
  /**
   * Create Word document from assignment template
   */
  createWordDocument(assignment: AssignmentData): Promise<WordDocument>;
  
  /**
   * Generate Excel grade tracker
   */
  createGradeTracker(courseId: string, assignments: AssignmentData[]): Promise<ExcelSpreadsheet>;
  
  /**
   * Generate PowerPoint from assignment content
   */
  createPowerPoint(assignment: AssignmentData): Promise<PowerPointPresentation>;
  
  /**
   * Import student submission (Word/Excel/PPT)
   */
  importSubmission(file: File): Promise<SubmissionData>;
}

export interface WordDocument {
  path: string;
  url: string;
  template: string;
  sections: DocumentSection[];
}

export interface DocumentSection {
  title: string;
  content: string;
  style: string;
}

export interface ExcelSpreadsheet {
  path: string;
  url: string;
  sheets: ExcelSheet[];
}

export interface ExcelSheet {
  name: string;
  columns: string[];
  rowCount: number;
}

export interface PowerPointPresentation {
  path: string;
  url: string;
  slideCount: number;
  slides: SlideData[];
}

export interface SlideData {
  slideNumber: number;
  title: string;
  content: string;
  notes: string;
}

// ============================================================================
// VMware Integration
// ============================================================================

export interface VMwareIntegration {
  /**
   * Link assignment to VM snapshot
   */
  linkToSnapshot(assignmentId: string, snapshotId: string): Promise<void>;
  
  /**
   * Auto-provision lab environment for student
   */
  provisionLab(studentId: string, labTemplate: string): Promise<LabEnvironment>;
  
  /**
   * Track student VM usage
   */
  trackUsage(studentId: string, labId: string): Promise<VMUsage>;
  
  /**
   * Grade VM configuration
   */
  gradeVMConfiguration(studentId: string, expectedConfig: VMConfig): Promise<VMGrade>;
}

export interface LabEnvironment {
  labId: string;
  studentId: string;
  vms: VMInstance[];
  status: 'provisioning' | 'ready' | 'error';
  expiresAt: string;
}

export interface VMInstance {
  vmId: string;
  name: string;
  os: string;
  status: 'running' | 'stopped' | 'error';
  ipAddress?: string;
}

export interface VMUsage {
  studentId: string;
  labId: string;
  totalHours: number;
  lastAccess: string;
  vmActions: VMAction[];
}

export interface VMAction {
  action: 'start' | 'stop' | 'snapshot' | 'clone';
  timestamp: string;
  result: 'success' | 'failure';
}

export interface VMConfig {
  networkSettings: NetworkConfig;
  services: string[];
  firewallRules: FirewallRule[];
}

export interface NetworkConfig {
  subnets: string[];
  gateways: string[];
  dnsServers: string[];
}

export interface FirewallRule {
  port: number;
  protocol: 'tcp' | 'udp';
  action: 'allow' | 'deny';
}

export interface VMGrade {
  studentId: string;
  score: number;
  maxScore: number;
  feedback: string[];
  configIssues: ConfigIssue[];
}

export interface ConfigIssue {
  component: string;
  expected: string;
  actual: string;
  severity: 'critical' | 'major' | 'minor';
}

// ============================================================================
// Cisco Packet Tracer Integration
// ============================================================================

export interface CiscoPacketTracerIntegration {
  /**
   * Link assignment to .pkt file
   */
  linkToPacketFile(assignmentId: string, pktFilePath: string): Promise<void>;
  
  /**
   * Auto-grade network configuration
   */
  gradeNetworkConfig(submissionPath: string, expectedConfig: NetworkExpected): Promise<NetworkGrade>;
  
  /**
   * Track simulation progress
   */
  trackSimulation(studentId: string, assignmentId: string): Promise<SimulationProgress>;
  
  /**
   * Validate network topology
   */
  validateTopology(pktFilePath: string, requirements: TopologyRequirements): Promise<TopologyValidation>;
}

export interface NetworkExpected {
  devices: DeviceRequirement[];
  connections: ConnectionRequirement[];
  configurations: ConfigRequirement[];
}

export interface DeviceRequirement {
  type: 'router' | 'switch' | 'pc' | 'server';
  count: number;
  model?: string;
}

export interface ConnectionRequirement {
  from: string;
  to: string;
  type: 'copper' | 'fiber' | 'wireless';
}

export interface ConfigRequirement {
  device: string;
  command: string;
  expectedOutput: string;
}

export interface NetworkGrade {
  studentId: string;
  score: number;
  maxScore: number;
  devicesCorrect: number;
  connectionsCorrect: number;
  configsCorrect: number;
  feedback: string[];
}

export interface SimulationProgress {
  studentId: string;
  assignmentId: string;
  simulationCount: number;
  lastSimulation: string;
  packetsSent: number;
  packetsReceived: number;
  errors: SimulationError[];
}

export interface SimulationError {
  type: 'connectivity' | 'configuration' | 'protocol';
  description: string;
  timestamp: string;
}

export interface TopologyRequirements {
  minDevices: number;
  requiredDevices: string[];
  requiredConnections: string[];
  subnetRequirements: SubnetRequirement[];
}

export interface SubnetRequirement {
  name: string;
  minHosts: number;
  vlan?: number;
}

export interface TopologyValidation {
  valid: boolean;
  deviceCount: number;
  connectionCount: number;
  issues: TopologyIssue[];
}

export interface TopologyIssue {
  type: 'missing_device' | 'missing_connection' | 'incorrect_subnet';
  description: string;
  severity: 'critical' | 'warning';
}

// ============================================================================
// Assignment Data Type (shared)
// ============================================================================

export interface AssignmentData {
  id: string;
  courseId: string;
  moduleId: string;
  name: string;
  description: string;
  type: 'discussion' | 'quiz' | 'project' | 'lab' | 'exam';
  points: number;
  dueDate: string;
  objectives: string[];
  rubric?: RubricData[];
  platformLinks?: PlatformLink[];
}

export interface RubricData {
  criterion: string;
  levels: RubricLevel[];
}

export interface RubricLevel {
  name: string;
  points: number;
  description: string;
}

export interface PlatformLink {
  platform: 'comptia' | 'vmware' | 'cisco' | 'ms_office';
  url: string;
  description: string;
}

export interface SubmissionData {
  studentId: string;
  assignmentId: string;
  submittedAt: string;
  fileCount: number;
  files: SubmittedFile[];
}

export interface SubmittedFile {
  name: string;
  type: string;
  size: number;
  url: string;
}
