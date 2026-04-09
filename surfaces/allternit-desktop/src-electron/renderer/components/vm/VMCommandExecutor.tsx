/**
 * VM Command Executor Component
 * 
 * Interface for executing commands in the VM.
 */

import React, { useState, useCallback } from 'react';
import type { VMExecuteOptions, VMExecuteResult } from '../../shared/types';

export interface VMCommandExecutorProps {
  onExecute: (options: VMExecuteOptions) => Promise<VMExecuteResult>;
  disabled?: boolean;
}

export const VMCommandExecutor: React.FC<VMCommandExecutorProps> = ({
  onExecute,
  disabled = false,
}) => {
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [workingDir, setWorkingDir] = useState('');
  const [result, setResult] = useState<VMExecuteResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  const handleExecute = useCallback(async () => {
    if (!command.trim()) return;

    setIsExecuting(true);
    setResult(null);

    try {
      const options: VMExecuteOptions = {
        command: command.trim(),
        args: args.trim().split(/\s+/).filter(Boolean),
        workingDir: workingDir.trim() || undefined,
        timeout: 60000,
      };

      const execResult = await onExecute(options);
      setResult(execResult);

      // Add to history
      const fullCommand = `${command} ${args}`.trim();
      setHistory(prev => [fullCommand, ...prev.slice(0, 9)]);
    } catch (err) {
      setResult({
        success: false,
        stdout: '',
        stderr: err instanceof Error ? err.message : String(err),
        exitCode: -1,
        executionTime: 0,
      });
    } finally {
      setIsExecuting(false);
    }
  }, [command, args, workingDir, onExecute]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleExecute();
    }
  }, [handleExecute]);

  const loadFromHistory = (cmd: string) => {
    const parts = cmd.split(' ');
    setCommand(parts[0]);
    setArgs(parts.slice(1).join(' '));
  };

  return (
    <div className="vm-command-executor">
      <h3>Execute Command</h3>

      <div className="command-form">
        <div className="form-row">
          <label>Command</label>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., npm, python, cargo"
            disabled={disabled || isExecuting}
          />
        </div>

        <div className="form-row">
          <label>Arguments</label>
          <input
            type="text"
            value={args}
            onChange={(e) => setArgs(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., install, test, build"
            disabled={disabled || isExecuting}
          />
        </div>

        <div className="form-row">
          <label>Working Directory</label>
          <input
            type="text"
            value={workingDir}
            onChange={(e) => setWorkingDir(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="/workspace (optional)"
            disabled={disabled || isExecuting}
          />
        </div>

        <button
          className="execute-button"
          onClick={handleExecute}
          disabled={disabled || isExecuting || !command.trim()}
        >
          {isExecuting ? (
            <>
              <span className="spinner" />
              Executing...
            </>
          ) : (
            <>
              <span className="icon">▶️</span>
              Execute (Cmd+Enter)
            </>
          )}
        </button>
      </div>

      {history.length > 0 && (
        <div className="command-history">
          <h4>Recent Commands</h4>
          <div className="history-list">
            {history.map((cmd, index) => (
              <button
                key={index}
                className="history-item"
                onClick={() => loadFromHistory(cmd)}
              >
                {cmd}
              </button>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div className={`execution-result ${result.success ? 'success' : 'error'}`}>
          <div className="result-header">
            <span className={`status-badge ${result.success ? 'success' : 'error'}`}>
              {result.success ? '✅ Success' : '❌ Failed'}
            </span>
            <span className="exit-code">Exit Code: {result.exitCode}</span>
            <span className="execution-time">
              {result.executionTime.toFixed(0)}ms
            </span>
          </div>

          {result.stdout && (
            <div className="output-section">
              <h5>Output</h5>
              <pre className="output-content stdout">{result.stdout}</pre>
            </div>
          )}

          {result.stderr && (
            <div className="output-section">
              <h5>Error Output</h5>
              <pre className="output-content stderr">{result.stderr}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VMCommandExecutor;
