/**
 * Teacher Preference Intake System
 * 
 * Collects teacher preferences through:
 * 1. Interactive questions
 * 2. Analysis of existing Canvas content
 * 3. Automatic profile generation
 * 
 * @module summit.canvas.teacher_intake
 */

import { CanvasConnector } from './canvas-connector';

// ============================================================================
// Types
// ============================================================================

export interface TeacherIntakeQuestion {
  id: string;
  category: 'formatting' | 'grading' | 'communication' | 'platforms';
  question: string;
  type: 'multiple_choice' | 'text' | 'scale' | 'upload' | 'boolean';
  options?: string[];
  default?: any;
  required: boolean;
}

export interface TeacherIntakeResponse {
  questionId: string;
  answer: any;
  timestamp: string;
}

export interface StyleAnalysis {
  formattingPatterns: {
    alwaysIncludes: string[];
    neverIncludes: string[];
    commonStructure: string[];
    averageWordCount: number;
  };
  gradingPatterns: {
    averagePoints: number;
    commonRubricCriteria: string[];
    latePolicy: string;
    missingPolicy: string;
  };
  communicationPatterns: {
    tone: 'formal' | 'casual' | 'encouraging' | 'direct';
    commonPhrases: string[];
    emojiUsage: 'never' | 'sometimes' | 'always';
  };
}

export interface TeacherProfile {
  teacher_id: string;
  name: string;
  email?: string;
  course_ids: string[];
  preferences: {
    assignment_format: {
      include_objectives: boolean;
      include_rubric: boolean;
      include_materials_list: boolean;
      include_timeline: boolean;
      points_default: number;
      submission_type: string;
      file_types: string[];
      due_time: string;
    };
    grading: {
      late_policy: string;
      missing_policy: string;
      allow_resubmission: boolean;
      auto_grade_quizzes: boolean;
    };
    communication: {
      tone: string;
      announcement_frequency: string;
      email_notifications: boolean;
    };
  };
  external_platforms: {
    turnitin?: boolean;
    piazza?: boolean;
    coursera?: boolean;
    other: string[];
  };
  created_at: string;
  updated_at: string;
  source: 'manual' | 'analyzed' | 'hybrid';
}

// ============================================================================
// Intake Questions
// ============================================================================

export const TEACHER_INTAKE_QUESTIONS: TeacherIntakeQuestion[] = [
  // Formatting
  {
    id: 'fmt_objectives',
    category: 'formatting',
    question: 'Do you include learning objectives in your assignments?',
    type: 'multiple_choice',
    options: ['Always', 'Usually', 'Sometimes', 'Never'],
    default: 'Always',
    required: true,
  },
  {
    id: 'fmt_rubric',
    category: 'formatting',
    question: 'Do you include rubrics with your assignments?',
    type: 'multiple_choice',
    options: ['Always', 'Usually', 'Sometimes', 'Never'],
    default: 'Always',
    required: true,
  },
  {
    id: 'fmt_materials',
    category: 'formatting',
    question: 'Do you list required materials/resources?',
    type: 'boolean',
    default: true,
    required: true,
  },
  {
    id: 'fmt_timeline',
    category: 'formatting',
    question: 'Do you include timeline/estimated hours?',
    type: 'boolean',
    default: true,
    required: false,
  },
  {
    id: 'fmt_default_points',
    category: 'formatting',
    question: 'What is your default point value for assignments?',
    type: 'scale',
    default: 100,
    required: true,
  },
  {
    id: 'fmt_file_types',
    category: 'formatting',
    question: 'What file types do you accept for submissions?',
    type: 'multiple_choice',
    options: ['pdf', 'docx', 'txt', 'zip', 'code', 'video', 'any'],
    default: ['pdf', 'docx'],
    required: true,
  },
  
  // Grading
  {
    id: 'grade_late_policy',
    category: 'grading',
    question: 'What is your late submission policy?',
    type: 'multiple_choice',
    options: [
      'No late submissions',
      '10% deduction per day',
      '20% deduction per day',
      '50% deduction after due date',
      'Full credit until deadline extension',
    ],
    default: '10% deduction per day',
    required: true,
  },
  {
    id: 'grade_missing_policy',
    category: 'grading',
    question: 'What happens to missing work?',
    type: 'multiple_choice',
    options: ['0 points', 'Can make up anytime', 'Can make up with penalty', 'Incomplete until submitted'],
    default: '0 points',
    required: true,
  },
  {
    id: 'grade_resubmission',
    category: 'grading',
    question: 'Do you allow resubmissions?',
    type: 'boolean',
    default: true,
    required: true,
  },
  {
    id: 'grade_auto_quiz',
    category: 'grading',
    question: 'Should quizzes be auto-graded?',
    type: 'boolean',
    default: true,
    required: true,
  },
  
  // Communication
  {
    id: 'comm_tone',
    category: 'communication',
    question: 'What is your communication tone?',
    type: 'multiple_choice',
    options: ['Formal', 'Casual', 'Encouraging', 'Direct', 'Friendly'],
    default: 'Encouraging',
    required: true,
  },
  {
    id: 'comm_announcements',
    category: 'communication',
    question: 'How often do you post announcements?',
    type: 'multiple_choice',
    options: ['Daily', 'Weekly', 'Per module', 'Only when necessary'],
    default: 'Weekly',
    required: true,
  },
  {
    id: 'comm_email',
    category: 'communication',
    question: 'Do you want email notifications for submissions?',
    type: 'boolean',
    default: true,
    required: true,
  },
  
  // Platforms
  {
    id: 'platform_turnitin',
    category: 'platforms',
    question: 'Do you use Turnitin for plagiarism checking?',
    type: 'boolean',
    default: false,
    required: false,
  },
  {
    id: 'platform_piazza',
    category: 'platforms',
    question: 'Do you use Piazza for discussions?',
    type: 'boolean',
    default: false,
    required: false,
  },
  {
    id: 'platform_other',
    category: 'platforms',
    question: 'What other platforms do you use?',
    type: 'text',
    default: '',
    required: false,
  },
];

// ============================================================================
// Teacher Intake System
// ============================================================================

export class TeacherIntakeSystem {
  private canvasConnector: CanvasConnector;
  private responses: Map<string, TeacherIntakeResponse[]> = new Map();

  constructor(canvasConnector?: CanvasConnector) {
    this.canvasConnector = canvasConnector || new CanvasConnector();
  }

  /**
   * Get all intake questions
   */
  getQuestions(category?: string): TeacherIntakeQuestion[] {
    if (!category) {
      return TEACHER_INTAKE_QUESTIONS;
    }
    return TEACHER_INTAKE_QUESTIONS.filter(q => q.category === category);
  }

  /**
   * Submit a response
   */
  submitResponse(teacherId: string, questionId: string, answer: any): TeacherIntakeResponse {
    const response: TeacherIntakeResponse = {
      questionId,
      answer,
      timestamp: new Date().toISOString(),
    };

    if (!this.responses.has(teacherId)) {
      this.responses.set(teacherId, []);
    }
    this.responses.get(teacherId)!.push(response);

    return response;
  }

  /**
   * Generate profile from responses
   */
  async generateProfileFromResponses(
    teacherId: string,
    name: string,
    email?: string
  ): Promise<TeacherProfile> {
    const teacherResponses = this.responses.get(teacherId) || [];
    
    if (teacherResponses.length === 0) {
      throw new Error('No responses submitted for this teacher');
    }

    // Build profile from responses
    const profile: TeacherProfile = {
      teacher_id: teacherId,
      name,
      email,
      course_ids: [],
      preferences: {
        assignment_format: {
          include_objectives: this.getAnswer(teacherResponses, 'fmt_objectives') === 'Always',
          include_rubric: this.getAnswer(teacherResponses, 'fmt_rubric') === 'Always',
          include_materials_list: this.getAnswer(teacherResponses, 'fmt_materials', true),
          include_timeline: this.getAnswer(teacherResponses, 'fmt_timeline', true),
          points_default: this.getAnswer(teacherResponses, 'fmt_default_points', 100),
          submission_type: 'online_upload',
          file_types: this.getAnswer(teacherResponses, 'fmt_file_types', ['pdf', 'docx']),
          due_time: '23:59',
        },
        grading: {
          late_policy: this.getAnswer(teacherResponses, 'grade_late_policy', '10% deduction per day'),
          missing_policy: this.getAnswer(teacherResponses, 'grade_missing_policy', '0 points'),
          allow_resubmission: this.getAnswer(teacherResponses, 'grade_resubmission', true),
          auto_grade_quizzes: this.getAnswer(teacherResponses, 'grade_auto_quiz', true),
        },
        communication: {
          tone: this.getAnswer(teacherResponses, 'comm_tone', 'Encouraging'),
          announcement_frequency: this.getAnswer(teacherResponses, 'comm_announcements', 'Weekly'),
          email_notifications: this.getAnswer(teacherResponses, 'comm_email', true),
        },
      },
      external_platforms: {
        turnitin: this.getAnswer(teacherResponses, 'platform_turnitin', false),
        piazza: this.getAnswer(teacherResponses, 'platform_piazza', false),
        other: [this.getAnswer(teacherResponses, 'platform_other', '')].filter(Boolean),
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      source: 'manual',
    };

    return profile;
  }

  /**
   * Analyze existing Canvas content to learn teacher style
   */
  async analyzeExistingContent(courseId: string): Promise<StyleAnalysis> {
    if (!this.canvasConnector.isConfigured()) {
      throw new Error('Canvas connector not configured');
    }

    const analysis: StyleAnalysis = {
      formattingPatterns: {
        alwaysIncludes: [],
        neverIncludes: [],
        commonStructure: [],
        averageWordCount: 0,
      },
      gradingPatterns: {
        averagePoints: 0,
        commonRubricCriteria: [],
        latePolicy: '',
        missingPolicy: '',
      },
      communicationPatterns: {
        tone: 'encouraging',
        commonPhrases: [],
        emojiUsage: 'sometimes',
      },
    };

    try {
      // Get all assignments in course
      const modules = await this.canvasConnector.listModules(courseId);
      
      let totalPoints = 0;
      let assignmentCount = 0;
      const wordCounts: number[] = [];
      const structures: Map<string, number> = new Map();

      for (const module of modules) {
        // Analyze each module's assignments
        // In production, would fetch assignments and analyze content
        // For now, simplified analysis
      }

      // Calculate averages
      analysis.gradingPatterns.averagePoints = totalPoints / (assignmentCount || 1);
      analysis.formattingPatterns.averageWordCount = 
        wordCounts.reduce((a, b) => a + b, 0) / (wordCounts.length || 1);

      // Find common structures
      const sortedStructures = Array.from(structures.entries())
        .sort((a, b) => b[1] - a[1]);
      
      analysis.formattingPatterns.commonStructure = sortedStructures
        .filter(([_, count]) => count > modules.length * 0.5)
        .map(([structure]) => structure);

      return analysis;
    } catch (error: any) {
      console.error('[TeacherIntake] Analysis error:', error);
      return analysis;
    }
  }

  /**
   * Generate profile from Canvas analysis
   */
  async generateProfileFromAnalysis(
    teacherId: string,
    name: string,
    courseId: string
  ): Promise<TeacherProfile> {
    const analysis = await this.analyzeExistingContent(courseId);

    const profile: TeacherProfile = {
      teacher_id: teacherId,
      name,
      course_ids: [courseId],
      preferences: {
        assignment_format: {
          include_objectives: analysis.formattingPatterns.alwaysIncludes.includes('objectives'),
          include_rubric: analysis.formattingPatterns.alwaysIncludes.includes('rubric'),
          include_materials_list: analysis.formattingPatterns.alwaysIncludes.includes('materials'),
          include_timeline: analysis.formattingPatterns.alwaysIncludes.includes('timeline'),
          points_default: analysis.gradingPatterns.averagePoints || 100,
          submission_type: 'online_upload',
          file_types: ['pdf', 'docx'],
          due_time: '23:59',
        },
        grading: {
          late_policy: analysis.gradingPatterns.latePolicy || '10% deduction per day',
          missing_policy: analysis.gradingPatterns.missingPolicy || '0 points',
          allow_resubmission: true,
          auto_grade_quizzes: true,
        },
        communication: {
          tone: analysis.communicationPatterns.tone,
          announcement_frequency: 'Weekly',
          email_notifications: true,
        },
      },
      external_platforms: {
        turnitin: false,
        piazza: false,
        other: [],
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      source: 'analyzed',
    };

    return profile;
  }

  /**
   * Generate hybrid profile (responses + analysis)
   */
  async generateHybridProfile(
    teacherId: string,
    name: string,
    email: string,
    courseId: string
  ): Promise<TeacherProfile> {
    // Get manual responses
    const manualProfile = await this.generateProfileFromResponses(teacherId, name, email);
    
    // Get analysis
    const analysisProfile = await this.generateProfileFromAnalysis(teacherId, name, courseId);
    
    // Merge: manual takes precedence, analysis fills gaps
    const hybridProfile: TeacherProfile = {
      ...analysisProfile,
      ...manualProfile,
      preferences: {
        assignment_format: {
          ...analysisProfile.preferences.assignment_format,
          ...manualProfile.preferences.assignment_format,
        },
        grading: {
          ...analysisProfile.preferences.grading,
          ...manualProfile.preferences.grading,
        },
        communication: {
          ...analysisProfile.preferences.communication,
          ...manualProfile.preferences.communication,
        },
      },
      source: 'hybrid',
    };

    return hybridProfile;
  }

  /**
   * Helper: Get answer from responses
   */
  private getAnswer(responses: TeacherIntakeResponse[], questionId: string, defaultValue?: any): any {
    const response = responses.find(r => r.questionId === questionId);
    return response?.answer ?? defaultValue;
  }

  /**
   * Save profile to storage
   */
  async saveProfile(profile: TeacherProfile): Promise<void> {
    // In production, save to database
    // For now, log to console
    console.log('[TeacherIntake] Profile saved:', profile);
  }

  /**
   * Load profile from storage
   */
  async loadProfile(teacherId: string): Promise<TeacherProfile | null> {
    // In production, load from database
    // For now, return null
    return null;
  }
}

/**
 * Factory function to create teacher intake system
 */
export function createTeacherIntakeSystem(canvasConnector?: CanvasConnector): TeacherIntakeSystem {
  return new TeacherIntakeSystem(canvasConnector);
}
