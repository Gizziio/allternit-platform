#!/usr/bin/env node
/**
 * Filesystem Course Agent
 * 
 * Answers questions about course content by reading files directly.
 * No RAG, no vectors - just reads the filesystem context.
 * 
 * Usage:
 *   const agent = createFilesystemAgent('/workspace/courses/AI_Fundamentals');
 *   const answer = await agent.answer("What's due this week?");
 */

import fs from 'fs/promises';
import path from 'path';

export interface FilesystemAgentConfig {
  courseRoot: string;
  teacherProfilePath?: string;
}

export interface CourseContext {
  courseName: string;
  modules: ModuleInfo[];
  assignments: AssignmentInfo[];
  teacherNotes?: string;
}

export interface ModuleInfo {
  name: string;
  path: string;
  content?: string;
}

export interface AssignmentInfo {
  name: string;
  path: string;
  dueDate?: string;
  points?: number;
  content?: string;
}

export class FilesystemCourseAgent {
  private courseRoot: string;
  private teacherProfilePath: string;
  private cache: Map<string, string> = new Map();

  constructor(config: FilesystemAgentConfig) {
    this.courseRoot = config.courseRoot;
    this.teacherProfilePath = config.teacherProfilePath || path.join(config.courseRoot, '../teacher_profiles');
  }

  /**
   * Answer a question about the course
   */
  async answer(question: string): Promise<string> {
    // Load course context
    const context = await this.loadCourseContext();

    // Route question to appropriate handler
    const lowerQuestion = question.toLowerCase();

    if (lowerQuestion.includes('due') || lowerQuestion.includes('deadline')) {
      return this.answerDueDates(question, context);
    }

    if (lowerQuestion.includes('module') || lowerQuestion.includes('week')) {
      return this.answerModuleQuestion(question, context);
    }

    if (lowerQuestion.includes('assignment') || lowerQuestion.includes('homework')) {
      return this.answerAssignmentQuestion(question, context);
    }

    if (lowerQuestion.includes('grade') || lowerQuestion.includes('point')) {
      return this.answerGradingQuestion(question, context);
    }

    if (lowerQuestion.includes('teacher') || lowerQuestion.includes('policy')) {
      return this.answerPolicyQuestion(question, context);
    }

    // Default: search all content
    return this.searchContent(question, context);
  }

  /**
   * Load course context from filesystem
   */
  async loadCourseContext(): Promise<CourseContext> {
    const context: CourseContext = {
      courseName: path.basename(this.courseRoot),
      modules: [],
      assignments: [],
    };

    try {
      // Read modules directory
      const modulesPath = path.join(this.courseRoot, 'modules');
      const moduleFiles = await fs.readdir(modulesPath).catch(() => []);

      for (const file of moduleFiles) {
        if (file.endsWith('.md')) {
          const filePath = path.join(modulesPath, file);
          const content = await this.readFile(filePath);
          context.modules.push({
            name: file.replace('.md', ''),
            path: filePath,
            content,
          });
        }
      }

      // Read assignments directory
      const assignmentsPath = path.join(this.courseRoot, 'assignments');
      const assignmentFiles = await fs.readdir(assignmentsPath).catch(() => []);

      for (const file of assignmentFiles) {
        if (file.endsWith('.md')) {
          const filePath = path.join(assignmentsPath, file);
          const content = await this.readFile(filePath);
          
          // Extract due date and points from content
          const dueDate = this.extractDueDate(content);
          const points = this.extractPoints(content);

          context.assignments.push({
            name: file.replace('.md', ''),
            path: filePath,
            dueDate,
            points,
            content,
          });
        }
      }

      // Read teacher notes
      const teacherNotesPath = path.join(this.courseRoot, 'teacher_notes.md');
      context.teacherNotes = await this.readFile(teacherNotesPath).catch(() => undefined);

    } catch (error) {
      console.error('[FilesystemAgent] Error loading context:', error);
    }

    return context;
  }

  /**
   * Answer questions about due dates
   */
  private answerDueDates(question: string, context: CourseContext): string {
    const now = new Date();
    const thisWeekEnd = new Date();
    thisWeekEnd.setDate(now.getDate() + 7);

    const dueThisWeek = context.assignments.filter(a => {
      if (!a.dueDate) return false;
      const due = new Date(a.dueDate);
      return due >= now && due <= thisWeekEnd;
    });

    if (dueThisWeek.length === 0) {
      return "Nothing is due this week. 🎉";
    }

    let answer = "Here's what's due this week:\n\n";
    dueThisWeek.forEach(a => {
      answer += `- **${a.name}** - Due: ${a.dueDate} (${a.points} points)\n`;
    });

    return answer;
  }

  /**
   * Answer questions about modules
   */
  private answerModuleQuestion(question: string, context: CourseContext): string {
    // Check for specific module number
    const moduleMatch = question.match(/module\s*(\d+)|week\s*(\d+)/i);
    
    if (moduleMatch) {
      const moduleNum = moduleMatch[1] || moduleMatch[2];
      const module = context.modules.find(m => m.name.toLowerCase().includes(`module_${moduleNum}`) || m.name.toLowerCase().includes(`week_${moduleNum}`));
      
      if (module && module.content) {
        return `Here's what's in Module ${moduleNum}:\n\n${this.summarizeContent(module.content)}`;
      }
      
      return `Module ${moduleNum} not found. Available modules: ${context.modules.map(m => m.name).join(', ')}`;
    }

    // List all modules
    if (question.includes('list') || question.includes('all') || question.includes('what')) {
      let answer = "Here are the modules in this course:\n\n";
      context.modules.forEach((m, i) => {
        answer += `${i + 1}. **${m.name}**\n`;
      });
      return answer;
    }

    return "I can help you find information about specific modules. Which module would you like to know about?";
  }

  /**
   * Answer questions about assignments
   */
  private answerAssignmentQuestion(question: string, context: CourseContext): string {
    // Check for specific assignment
    const assignmentKeywords = question.split(' ').filter(w => w.length > 4);
    
    for (const keyword of assignmentKeywords) {
      const assignment = context.assignments.find(a => 
        a.name.toLowerCase().includes(keyword.toLowerCase())
      );
      
      if (assignment && assignment.content) {
        return `Here's the assignment "${assignment.name}":\n\n${this.summarizeContent(assignment.content)}`;
      }
    }

    // List all assignments
    let answer = "Here are the assignments in this course:\n\n";
    context.assignments.forEach((a, i) => {
      answer += `${i + 1}. **${a.name}** - ${a.points} points, Due: ${a.dueDate || 'TBD'}\n`;
    });
    return answer;
  }

  /**
   * Answer questions about grading
   */
  private answerGradingQuestion(question: string, context: CourseContext): string {
    if (context.teacherNotes) {
      const gradingSection = this.extractSection(context.teacherNotes, 'grading');
      if (gradingSection) {
        return `Here's the grading policy:\n\n${gradingSection}`;
      }
    }

    // Calculate total points
    const totalPoints = context.assignments.reduce((sum, a) => sum + (a.points || 0), 0);
    
    return `Total points in this course: ${totalPoints}\n\nIndividual assignment points vary. Check each assignment for details.`;
  }

  /**
   * Answer questions about teacher policies
   */
  private answerPolicyQuestion(question: string, context: CourseContext): string {
    if (context.teacherNotes) {
      const policySection = this.extractSection(context.teacherNotes, 'policy');
      if (policySection) {
        return `Here's the policy:\n\n${policySection}`;
      }
    }

    return "I couldn't find specific policy information. Please check the course syllabus or ask your teacher directly.";
  }

  /**
   * Search all content for answer
   */
  private searchContent(question: string, context: CourseContext): string {
    const keywords = question.toLowerCase().split(' ').filter(w => w.length > 3);
    
    // Search modules
    for (const module of context.modules) {
      if (module.content) {
        const matches = keywords.filter(k => module.content!.toLowerCase().includes(k));
        if (matches.length >= 2) {
          return `I found relevant information in **${module.name}**:\n\n${this.summarizeContent(module.content, 200)}`;
        }
      }
    }

    // Search assignments
    for (const assignment of context.assignments) {
      if (assignment.content) {
        const matches = keywords.filter(k => assignment.content!.toLowerCase().includes(k));
        if (matches.length >= 2) {
          return `I found relevant information in **${assignment.name}**:\n\n${this.summarizeContent(assignment.content, 200)}`;
        }
      }
    }

    return "I couldn't find specific information about that in the course materials. Please ask your teacher for clarification.";
  }

  /**
   * Read file with caching
   */
  private async readFile(filePath: string): Promise<string> {
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath)!;
    }

    const content = await fs.readFile(filePath, 'utf-8');
    this.cache.set(filePath, content);
    return content;
  }

  /**
   * Extract due date from content
   */
  private extractDueDate(content: string): string | undefined {
    const dueMatch = content.match(/due[:\s]+(\d{4}-\d{2}-\d{2})/i);
    return dueMatch ? dueMatch[1] : undefined;
  }

  /**
   * Extract points from content
   */
  private extractPoints(content: string): number | undefined {
    const pointsMatch = content.match(/(\d+)\s*points?/i);
    return pointsMatch ? parseInt(pointsMatch[1]) : undefined;
  }

  /**
   * Extract section from markdown content
   */
  private extractSection(content: string, sectionName: string): string | undefined {
    const sectionRegex = new RegExp(`##\\s*${sectionName}.*?\n(.*?)(?=\n##|$)`, 'is');
    const match = content.match(sectionRegex);
    return match ? match[1].trim() : undefined;
  }

  /**
   * Summarize content (extract key points)
   */
  private summarizeContent(content: string, maxLength: number = 300): string {
    // Extract headings
    const headings = content.match(/##.+$/gm) || [];
    
    if (headings.length > 0) {
      return headings.slice(0, 5).join('\n');
    }

    // Fall back to first paragraph
    const firstParagraph = content.split('\n\n')[0];
    return firstParagraph.length > maxLength 
      ? firstParagraph.substring(0, maxLength) + '...'
      : firstParagraph;
  }
}

/**
 * Factory function to create filesystem agent
 */
export function createFilesystemAgent(courseRoot: string, teacherProfilePath?: string): FilesystemCourseAgent {
  return new FilesystemCourseAgent({ courseRoot, teacherProfilePath });
}
