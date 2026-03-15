/**
 * Canvas Browser Playbooks for Summit Tenant
 * 
 * Browser-based automation for Canvas LMS when API access is unavailable.
 * Uses A2R Operator browser-use skills for visual grounding and control.
 * 
 * These playbooks are tenant-specific (Summit OIC) and separate from the
 * core a2rchitech platform.
 * 
 * @module summit.canvas.browser_playbooks
 */

import { BrowserAutomationSession, BrowserUseSkill } from './browser-types';

export interface CanvasBrowserContext {
  courseId?: string;
  courseName?: string;
  currentUrl: string;
  pageTitle: string;
  isInCanvas: boolean;
  canvasDomain: string;
}

export interface ModulePlaybookArgs {
  courseUrl: string;
  moduleName: string;
  moduleDescription?: string;
  publishImmediately?: boolean;
  items?: ModuleItemArgs[];
}

export interface ModuleItemArgs {
  type: 'page' | 'assignment' | 'file' | 'external_url' | 'discussion';
  title: string;
  content?: string;
  url?: string;
  dueDate?: string;
  points?: number;
}

export interface PlaybookResult {
  success: boolean;
  createdObjects: CreatedObject[];
  errors: string[];
  finalUrl: string;
  screenshotPath?: string;
}

export interface CreatedObject {
  type: string;
  name: string;
  url?: string;
  id?: string;
}

/**
 * Detect if current page is Canvas and extract context
 */
export async function detectCanvasContext(session: BrowserAutomationSession): Promise<CanvasBrowserContext> {
  const currentUrl = await session.getCurrentUrl();
  const pageTitle = await session.getPageTitle();
  
  // Check if we're on a Canvas domain
  const canvasDomainMatch = currentUrl.match(/https?:\/\/([^.]+\.instructure\.com|canvas\.[^/]+)/);
  const isInCanvas = !!canvasDomainMatch || pageTitle.includes('Canvas');
  
  // Extract course ID from URL if present
  const courseIdMatch = currentUrl.match(/\/courses\/(\d+)/);
  const courseId = courseIdMatch ? courseIdMatch[1] : undefined;
  
  return {
    currentUrl,
    pageTitle,
    isInCanvas,
    canvasDomain: canvasDomainMatch?.[1] || 'unknown',
    courseId,
    courseName: undefined, // Would need to extract from page
  };
}

/**
 * Navigate to Canvas course modules page
 */
export async function navigateToCourseModules(
  session: BrowserAutomationSession,
  courseUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Navigate to course URL
    await session.navigate(courseUrl);
    await session.waitForPageLoad();
    
    // Look for "Modules" link in course navigation
    const modulesLink = await session.findElement({
      selector: 'a[href*="/modules"]',
      text: 'Modules',
    });
    
    if (modulesLink) {
      await session.clickElement(modulesLink);
      await session.waitForPageLoad();
      return { success: true };
    }
    
    // Fallback: construct modules URL directly
    const modulesUrl = courseUrl.replace(/\/(assignments|pages|files).*/, '') + '/modules';
    await session.navigate(modulesUrl);
    await session.waitForPageLoad();
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Create a module in Canvas via browser automation
 * This is the main playbook for module creation
 */
export async function createModulePlaybook(
  session: BrowserAutomationSession,
  args: ModulePlaybookArgs
): Promise<PlaybookResult> {
  const result: PlaybookResult = {
    success: false,
    createdObjects: [],
    errors: [],
    finalUrl: args.courseUrl,
  };
  
  try {
    // Step 1: Navigate to course modules page
    const navResult = await navigateToCourseModules(session, args.courseUrl);
    if (!navResult.success) {
      result.errors.push(`Failed to navigate to modules: ${navResult.error}`);
      return result;
    }
    
    result.finalUrl = await session.getCurrentUrl();
    
    // Step 2: Click "+ Module" button
    const addModuleButton = await session.findElement({
      selector: 'button[data-testid="add-module-button"], button:contains("Module")',
    });
    
    if (!addModuleButton) {
      result.errors.push('Could not find "Add Module" button');
      return result;
    }
    
    await session.clickElement(addModuleButton);
    await session.waitForTimeout(500);
    
    // Step 3: Fill in module name
    const nameInput = await session.findElement({
      selector: 'input[name="name"], input[placeholder*="module name"]',
    });
    
    if (!nameInput) {
      result.errors.push('Could not find module name input');
      return result;
    }
    
    await session.typeText(nameInput, args.moduleName);
    
    // Step 4: Fill description if provided
    if (args.moduleDescription) {
      const descInput = await session.findElement({
        selector: 'textarea[name="description"], textarea[placeholder*="description"]',
      });
      
      if (descInput) {
        await session.typeText(descInput, args.moduleDescription);
      }
    }
    
    // Step 5: Handle publish state
    if (args.publishImmediately !== undefined) {
      const publishCheckbox = await session.findElement({
        selector: 'input[type="checkbox"][name="published"]',
      });
      
      if (publishCheckbox) {
        const isChecked = await session.isElementChecked(publishCheckbox);
        if (args.publishImmediately && !isChecked) {
          await session.clickElement(publishCheckbox);
        } else if (!args.publishImmediately && isChecked) {
          await session.clickElement(publishCheckbox);
        }
      }
    }
    
    // Step 6: Save the module
    const saveButton = await session.findElement({
      selector: 'button[type="submit"], button:contains("Save"), button:contains("Add Module")',
    });
    
    if (!saveButton) {
      result.errors.push('Could not find save button');
      return result;
    }
    
    await session.clickElement(saveButton);
    await session.waitForTimeout(1000);
    
    // Step 7: Verify module was created
    const moduleElement = await session.findElement({
      selector: `div[data-module-name="${args.moduleName}"], li:contains("${args.moduleName}")`,
    });
    
    if (moduleElement) {
      result.createdObjects.push({
        type: 'module',
        name: args.moduleName,
      });
      result.success = true;
    } else {
      result.errors.push('Module creation verification failed');
    }
    
    // Step 8: Add items to module if specified
    if (args.items && args.items.length > 0 && result.success) {
      for (const item of args.items) {
        const itemResult = await addModuleItem(session, item);
        if (itemResult.success) {
          result.createdObjects.push(itemResult.createdObject);
        } else {
          result.errors.push(...itemResult.errors);
        }
      }
    }
    
    // Capture final screenshot
    result.screenshotPath = await session.captureScreenshot();
    
  } catch (error: any) {
    result.errors.push(`Playbook error: ${error.message}`);
  }
  
  return result;
}

/**
 * Add an item to a Canvas module
 */
async function addModuleItem(
  session: BrowserAutomationSession,
  args: ModuleItemArgs
): Promise<{ success: boolean; createdObject: any; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    // Click "+ Add item" in the module
    const addItemButton = await session.findElement({
      selector: 'button[data-testid="add-item"], button:contains("Add")',
    });
    
    if (!addItemButton) {
      errors.push('Could not find "Add item" button');
      return { success: false, createdObject: null, errors };
    }
    
    await session.clickElement(addItemButton);
    await session.waitForTimeout(300);
    
    // Select item type
    const typeSelect = await session.findElement({
      selector: 'select[name="type"], select.module-item-type',
    });
    
    if (typeSelect) {
      await session.selectOption(typeSelect, args.type);
    }
    
    // Fill in title
    const titleInput = await session.findElement({
      selector: 'input[name="title"], input[placeholder*="title"]',
    });
    
    if (!titleInput) {
      errors.push('Could not find title input');
      return { success: false, createdObject: null, errors };
    }
    
    await session.typeText(titleInput, args.title);
    
    // Fill content if provided (for pages)
    if (args.content && args.type === 'page') {
      const contentEditor = await session.findElement({
        selector: 'div[contenteditable="true"], textarea[name="body"]',
      });
      
      if (contentEditor) {
        await session.typeText(contentEditor, args.content);
      }
    }
    
    // Set due date for assignments
    if (args.dueDate && args.type === 'assignment') {
      const dueDateInput = await session.findElement({
        selector: 'input[name="due_at"], input[placeholder*="due date"]',
      });
      
      if (dueDateInput) {
        await session.typeText(dueDateInput, args.dueDate);
      }
    }
    
    // Set points for assignments
    if (args.points && args.type === 'assignment') {
      const pointsInput = await session.findElement({
        selector: 'input[name="points_possible"], input[placeholder*="points"]',
      });
      
      if (pointsInput) {
        await session.typeText(pointsInput, args.points.toString());
      }
    }
    
    // Save the item
    const saveButton = await session.findElement({
      selector: 'button[type="submit"], button:contains("Add Item"), button:contains("Save")',
    });
    
    if (!saveButton) {
      errors.push('Could not find save button');
      return { success: false, createdObject: null, errors };
    }
    
    await session.clickElement(saveButton);
    await session.waitForTimeout(500);
    
    return {
      success: true,
      createdObject: {
        type: args.type,
        name: args.title,
      },
      errors,
    };
  } catch (error: any) {
    errors.push(`Failed to add item: ${error.message}`);
    return { success: false, createdObject: null, errors };
  }
}

/**
 * Create a page in Canvas via browser automation
 */
export async function createPagePlaybook(
  session: BrowserAutomationSession,
  args: {
    courseUrl: string;
    title: string;
    body: string;
    publishImmediately?: boolean;
  }
): Promise<PlaybookResult> {
  const result: PlaybookResult = {
    success: false,
    createdObjects: [],
    errors: [],
    finalUrl: args.courseUrl,
  };
  
  try {
    // Navigate to course pages
    const pagesUrl = args.courseUrl.replace(/\/(modules|assignments|files).*/, '') + '/pages';
    await session.navigate(pagesUrl);
    await session.waitForPageLoad();
    
    result.finalUrl = await session.getCurrentUrl();
    
    // Click "+ Page" button
    const addPageButton = await session.findElement({
      selector: 'button:contains("New Page"), a:contains("New Page")',
    });
    
    if (!addPageButton) {
      result.errors.push('Could not find "New Page" button');
      return result;
    }
    
    await session.clickElement(addPageButton);
    await session.waitForPageLoad();
    
    // Fill title
    const titleInput = await session.findElement({
      selector: 'input[name="title"], input[placeholder*="Page Title"]',
    });
    
    if (!titleInput) {
      result.errors.push('Could not find title input');
      return result;
    }
    
    await session.typeText(titleInput, args.title);
    
    // Fill body content
    const bodyEditor = await session.findElement({
      selector: 'div[contenteditable="true"], textarea[name="body"]',
    });
    
    if (!bodyEditor) {
      result.errors.push('Could not find content editor');
      return result;
    }
    
    await session.typeText(bodyEditor, args.body);
    
    // Handle publish state
    if (args.publishImmediately !== undefined) {
      const publishCheckbox = await session.findElement({
        selector: 'input[type="checkbox"][name="published"]',
      });
      
      if (publishCheckbox) {
        const isChecked = await session.isElementChecked(publishCheckbox);
        if (args.publishImmediately && !isChecked) {
          await session.clickElement(publishCheckbox);
        }
      }
    }
    
    // Save the page
    const saveButton = await session.findElement({
      selector: 'button[type="submit"], button:contains("Save")',
    });
    
    if (!saveButton) {
      result.errors.push('Could not find save button');
      return result;
    }
    
    await session.clickElement(saveButton);
    await session.waitForTimeout(1000);
    
    // Verify page was created
    const pageTitle = await session.getPageTitle();
    if (pageTitle.includes(args.title)) {
      result.createdObjects.push({
        type: 'page',
        name: args.title,
      });
      result.success = true;
    } else {
      result.errors.push('Page creation verification failed');
    }
    
    result.screenshotPath = await session.captureScreenshot();
    
  } catch (error: any) {
    result.errors.push(`Playbook error: ${error.message}`);
  }
  
  return result;
}

/**
 * Create an assignment in Canvas via browser automation
 */
export async function createAssignmentPlaybook(
  session: BrowserAutomationSession,
  args: {
    courseUrl: string;
    name: string;
    description: string;
    points?: number;
    dueDate?: string;
    submissionTypes?: string[];
    publishImmediately?: boolean;
  }
): Promise<PlaybookResult> {
  const result: PlaybookResult = {
    success: false,
    createdObjects: [],
    errors: [],
    finalUrl: args.courseUrl,
  };
  
  try {
    // Navigate to course assignments
    const assignmentsUrl = args.courseUrl.replace(/\/(modules|pages|files).*/, '') + '/assignments';
    await session.navigate(assignmentsUrl);
    await session.waitForPageLoad();
    
    result.finalUrl = await session.getCurrentUrl();
    
    // Click "+ Assignment" button
    const addAssignmentButton = await session.findElement({
      selector: 'button:contains("New Assignment"), a:contains("New Assignment")',
    });
    
    if (!addAssignmentButton) {
      result.errors.push('Could not find "New Assignment" button');
      return result;
    }
    
    await session.clickElement(addAssignmentButton);
    await session.waitForPageLoad();
    
    // Fill assignment name
    const nameInput = await session.findElement({
      selector: 'input[name="name"], input[placeholder*="Assignment Name"]',
    });
    
    if (!nameInput) {
      result.errors.push('Could not find name input');
      return result;
    }
    
    await session.typeText(nameInput, args.name);
    
    // Fill description
    const descEditor = await session.findElement({
      selector: 'div[contenteditable="true"], textarea[name="description"]',
    });
    
    if (!descEditor) {
      result.errors.push('Could not find description editor');
      return result;
    }
    
    await session.typeText(descEditor, args.description);
    
    // Set points
    if (args.points) {
      const pointsInput = await session.findElement({
        selector: 'input[name="points_possible"]',
      });
      
      if (pointsInput) {
        await session.typeText(pointsInput, args.points.toString());
      }
    }
    
    // Set due date
    if (args.dueDate) {
      const dueDateInput = await session.findElement({
        selector: 'input[name="due_at"]',
      });
      
      if (dueDateInput) {
        await session.typeText(dueDateInput, args.dueDate);
      }
    }
    
    // Set submission types
    if (args.submissionTypes && args.submissionTypes.length > 0) {
      for (const type of args.submissionTypes) {
        const checkbox = await session.findElement({
          selector: `input[type="checkbox"][value="${type}"]`,
        });
        
        if (checkbox) {
          await session.clickElement(checkbox);
        }
      }
    }
    
    // Handle publish state
    if (args.publishImmediately !== undefined) {
      const publishCheckbox = await session.findElement({
        selector: 'input[type="checkbox"][name="published"]',
      });
      
      if (publishCheckbox) {
        const isChecked = await session.isElementChecked(publishCheckbox);
        if (args.publishImmediately && !isChecked) {
          await session.clickElement(publishCheckbox);
        }
      }
    }
    
    // Save the assignment
    const saveButton = await session.findElement({
      selector: 'button[type="submit"], button:contains("Save"), button:contains("Create")',
    });
    
    if (!saveButton) {
      result.errors.push('Could not find save button');
      return result;
    }
    
    await session.clickElement(saveButton);
    await session.waitForTimeout(1000);
    
    // Verify assignment was created
    const pageTitle = await session.getPageTitle();
    if (pageTitle.includes(args.name)) {
      result.createdObjects.push({
        type: 'assignment',
        name: args.name,
      });
      result.success = true;
    } else {
      result.errors.push('Assignment creation verification failed');
    }
    
    result.screenshotPath = await session.captureScreenshot();
    
  } catch (error: any) {
    result.errors.push(`Playbook error: ${error.message}`);
  }
  
  return result;
}

/**
 * Composite playbook: Create a multi-week course module package
 */
export async function createCourseModulePackage(
  session: BrowserAutomationSession,
  args: {
    courseUrl: string;
    packageName: string;
    weeks: number;
    weekTemplate: {
      moduleName: (week: number) => string;
      pages: Array<{ title: string; content: string }>;
      assignment?: { name: string; description: string; points: number };
    };
  }
): Promise<PlaybookResult> {
  const result: PlaybookResult = {
    success: false,
    createdObjects: [],
    errors: [],
    finalUrl: args.courseUrl,
  };
  
  try {
    for (let week = 1; week <= args.weeks; week++) {
      const weekName = args.weekTemplate.moduleName(week);
      
      // Create module for this week
      const moduleResult = await createModulePlaybook(session, {
        courseUrl: args.courseUrl,
        moduleName: weekName,
        publishImmediately: false,
        items: [],
      });
      
      if (!moduleResult.success) {
        result.errors.push(`Failed to create module for week ${week}: ${moduleResult.errors.join(', ')}`);
        continue;
      }
      
      result.createdObjects.push(...moduleResult.createdObjects);
      
      // Add pages to the module
      for (const page of args.weekTemplate.pages) {
        const pageResult = await createPagePlaybook(session, {
          courseUrl: args.courseUrl,
          title: page.title,
          body: page.content,
          publishImmediately: false,
        });
        
        if (pageResult.success) {
          result.createdObjects.push(...pageResult.createdObjects);
        } else {
          result.errors.push(...pageResult.errors);
        }
      }
      
      // Add assignment if specified
      if (args.weekTemplate.assignment) {
        const assignmentResult = await createAssignmentPlaybook(session, {
          courseUrl: args.courseUrl,
          name: args.weekTemplate.assignment.name,
          description: args.weekTemplate.assignment.description,
          points: args.weekTemplate.assignment.points,
          publishImmediately: false,
        });
        
        if (assignmentResult.success) {
          result.createdObjects.push(...assignmentResult.createdObjects);
        } else {
          result.errors.push(...assignmentResult.errors);
        }
      }
    }
    
    result.success = result.createdObjects.length > 0;
    result.finalUrl = await session.getCurrentUrl();
    result.screenshotPath = await session.captureScreenshot();
    
  } catch (error: any) {
    result.errors.push(`Package creation error: ${error.message}`);
  }
  
  return result;
}
