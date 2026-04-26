export interface IntelliScheduleInput {
  tasks: Array<{
    id: string;
    title: string;
    priority: number; // 1-100
    estimatedMinutes: number;
    deadline?: Date;
    dependencies: string[]; // task IDs that must complete first
    tags?: string[];
  }>;
  constraints: {
    availableHoursPerDay: number; // default 8
    startTime: Date;
    bufferMinutes: number; // default 15
  };
}

export interface IntelliScheduleOutput {
  orderedTasks: string[]; // Optimal execution order (task IDs)
  schedule: Array<{
    taskId: string;
    startTime: Date;
    endTime: Date;
    risk: 'low' | 'medium' | 'high';
  }>;
  unrunnable: string[]; // Tasks that cannot fit before deadline
}
