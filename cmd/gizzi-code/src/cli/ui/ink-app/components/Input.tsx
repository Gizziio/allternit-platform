import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface InputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  multiline?: boolean;
  disabled?: boolean;
}
export const Input: React.FC<InputProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder,
  multiline = false,
  disabled = false,
}) => {
  const [cursorPos, setCursorPos] = useState(value.length);
  useInput((input, key) => {
    if (disabled) return;
    if (key.return && !multiline) {
      onSubmit();
    } else if (key.return && multiline) {
      const newValue = value.slice(0, cursorPos) + '\n' + value.slice(cursorPos);
      onChange(newValue);
      setCursorPos(p => p + 1);
    } else if (key.backspace || key.delete) {
      if (cursorPos > 0) {
        const newValue = value.slice(0, cursorPos - 1) + value.slice(cursorPos);
        onChange(newValue);
        setCursorPos(p => p - 1);
      }
    } else if (key.leftArrow) {
      setCursorPos(p => Math.max(0, p - 1));
    } else if (key.rightArrow) {
      setCursorPos(p => Math.min(value.length, p + 1));
    } else if (key.upArrow && multiline) {
      // Move up a line (simplified)
      setCursorPos(p => Math.max(0, p - 40));
    } else if (key.downArrow && multiline) {
      // Move down a line (simplified)
      setCursorPos(p => Math.min(value.length, p + 40));
    } else if (key.home) {
      setCursorPos(0);
    } else if (key.end) {
      setCursorPos(value.length);
    } else if (key.escape) {
      // Clear input on escape
      onChange('');
    } else if (!key.ctrl && !key.meta && input) {
      const newValue = value.slice(0, cursorPos) + input + value.slice(cursorPos);
    }
  });
  const displayValue = value || placeholder || '';
  const isPlaceholder = !value && placeholder;
  return (
    <Box 
      borderStyle="single" 
      borderColor={disabled ? '#484f58' : '#30363d'}
      paddingX={1}
      backgroundColor={disabled ? '#161b22' : undefined}
    >
      <Text color="#d4b08c">❯ </Text>
      <Box flexGrow={1}>
        {multiline ? (
          <Box flexDirection="column">
            {displayValue.split('\n').map((line, i) => (
              <Text key={i} color={isPlaceholder ? '#484f58' : undefined}>
                {line}
              </Text>
            ))}
          </Box>
        ) : (
          <>
            <Text color={isPlaceholder ? '#484f58' : undefined}>
              {displayValue.slice(0, cursorPos)}
            </Text>
            {!disabled && (
              <Text color="#58a6ff">▌</Text>
            )}
              {displayValue.slice(cursorPos)}
          </>
        )}
      </Box>
    </Box>
  );
};
