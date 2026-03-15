/**
 * Summit Canvas Browser Automation Module
 * 
 * Browser-based Canvas LMS automation for when API access is unavailable.
 * Uses A2R Operator browser-use skills for visual grounding and control.
 * 
 * This module is part of the Summit OIC tenant overlay, separate from
 * the core a2rchitech platform.
 * 
 * @module summit.canvas
 */

// Types and interfaces
export * from './browser-types';

// Browser automation skill (connection to A2R Operator)
export {
  A2ROperatorBrowserSkill,
  A2ROperatorSessionFactory,
  createBrowserUseSkill,
  createBrowserSessionFactory,
} from './browser-use-skill';

// Canvas playbooks
export {
  // Context detection
  detectCanvasContext,
  CanvasBrowserContext,
  
  // Navigation
  navigateToCourseModules,
  
  // Module playbooks
  createModulePlaybook,
  ModulePlaybookArgs,
  ModuleItemArgs,
  
  // Page playbooks
  createPagePlaybook,
  
  // Assignment playbooks
  createAssignmentPlaybook,
  
  // Composite playbooks
  createCourseModulePackage,
  
  // Result types
  PlaybookResult,
  CreatedObject,
} from './canvas-browser-playbooks';

// Assignment Builder Skill
export {
  AssignmentBuilderSkill,
  createAssignmentBuilderSkill,
  type TeacherPreferences,
  type CreateAssignmentRequest,
  type AssignmentBuilderResult,
  type RubricCriterion,
} from './assignment_builder';

// Teacher Intake System
export {
  TeacherIntakeSystem,
  createTeacherIntakeSystem,
  type TeacherIntakeQuestion,
  type TeacherIntakeResponse,
  type StyleAnalysis,
  type TeacherProfile,
  TEACHER_INTAKE_QUESTIONS,
} from './teacher_intake';

// Canvas API Connector
export {
  CanvasConnector,
  createCanvasConnector,
  type CanvasConfig,
  type CanvasModule,
  type CanvasPage,
  type CanvasAssignment,
  type CreateModuleRequest,
  type CreatePageRequest,
  type CreateAssignmentRequest as CanvasCreateAssignmentRequest,
  type CanvasExecutionResult,
} from './canvas-connector';
