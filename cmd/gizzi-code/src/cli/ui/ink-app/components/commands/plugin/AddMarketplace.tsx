import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from 'src/services/analytics/index';
import { ConfigurableShortcutHint } from '../../components/ConfigurableShortcutHint';
import { Byline } from '../../components/design-system/Byline';
import { KeyboardShortcutHint } from '../../components/design-system/KeyboardShortcutHint';
import { Spinner } from '../../components/Spinner';
import TextInput from '../../components/TextInput';
import { Box, Text } from '../../core/ink';
import { toError } from '../../utils/errors';
import { logError } from '../../utils/log';
import { clearAllCaches } from '../../utils/plugins/cacheUtils';
import { addMarketplaceSource, saveMarketplaceToSettings } from '../../utils/plugins/marketplaceManager';
import { parseMarketplaceInput } from '../../utils/plugins/parseMarketplaceInput';
import type { ViewState } from './types';
type Props = {
  inputValue: string;
  setInputValue: (value: string) => void;
  cursorOffset: number;
  setCursorOffset: (offset: number) => void;
  error: string | null;
  setError: (error: string | null) => void;
  result: string | null;
  setResult: (result: string | null) => void;
  setViewState: (state: ViewState) => void;
  onAddComplete?: () => void | Promise<void>;
  cliMode?: boolean;
};
export function AddMarketplace({
  inputValue,
  setInputValue,
  cursorOffset,
  setCursorOffset,
  error,
  setError,
  result,
  setResult,
  setViewState,
  onAddComplete,
  cliMode = false
}: Props): React.ReactElement | null {
  const hasAttemptedAutoAdd = useRef(false);
  const [isLoading, setLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const handleAdd = async () => {
    const input = inputValue.trim();
    if (!input) {
      setError('Please enter a marketplace source');
      return;
    }
    const parsed = await parseMarketplaceInput(input);
    if (!parsed) {
      setError('Invalid marketplace source format. Try: owner/repo, https://..., or ./path');
      return;
    }
    // Check if parseMarketplaceInput returned an error
    if ('error' in parsed) {
      setError(parsed.error);
      return;
    }
    setError(null);
    try {
      setLoading(true);
      setProgressMessage('');
      const {
        name,
        resolvedSource
      } = await addMarketplaceSource(parsed, message => {
        setProgressMessage(message);
      });
      saveMarketplaceToSettings(name, {
        source: resolvedSource
      });
      clearAllCaches();
      let sourceType = parsed.source;
      if (parsed.source === 'github') {
        sourceType = parsed.repo as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS;
      }
      logEvent('tengu_marketplace_added', {
        source_type: sourceType as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
      if (onAddComplete) {
        await onAddComplete();
      }
      setLoading(false);
      if (cliMode) {
        // In CLI mode, set result to trigger completion
        setResult(`Successfully added marketplace: ${name}`);
      } else {
        // In interactive mode, switch to browse view
        setViewState({
          type: 'browse-marketplace',
          targetMarketplace: name
        });
      }
    } catch (err) {
      const error = toError(err);
      logError(error);
      setError(error.message);
      if (cliMode) {
        // In CLI mode, set result with error to trigger completion
        setResult(`Error: ${error.message}`);
      }
      setLoading(false);
      setResult(null);
    }
  };
  // Auto-add if inputValue is provided
  useEffect(() => {
    if (inputValue && !hasAttemptedAutoAdd.current && !error && !result) {
      hasAttemptedAutoAdd.current = true;
      void handleAdd();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // biome-ignore lint/correctness/useExhaustiveDependencies: intentional
  }, []); // Only run once on mount
  return <Box flexDirection="column">
      <Box flexDirection="column" paddingX={1} borderStyle="round">
        <Box marginBottom={1}>
          <Text bold>Add Marketplace</Text>
        </Box>
        <Box flexDirection="column">
          <Text>Enter marketplace source:</Text>
          <Text dimColor>Examples:</Text>
          <Text dimColor> · owner/repo (GitHub)</Text>
          <Text dimColor> · git@github.com:owner/repo.git (SSH)</Text>
          <Text dimColor> · https://example.com/marketplace.json</Text>
          <Text dimColor> · ./path/to/marketplace</Text>
          <Box marginTop={1}>
            <TextInput value={inputValue} onChange={setInputValue} onSubmit={handleAdd} columns={80} cursorOffset={cursorOffset} onChangeCursorOffset={setCursorOffset} focus showCursor />
          </Box>
        </Box>
        {isLoading && <Box marginTop={1}>
            <Spinner />
            <Text>
              {progressMessage || 'Adding marketplace to configuration…'}
            </Text>
          </Box>}
        {error && <Box marginTop={1}>
            <Text color="error">{error}</Text>
          </Box>}
        {result && <Box marginTop={1}>
            <Text>{result}</Text>
          </Box>}
      </Box>
      <Box marginLeft={3}>
        <Text dimColor italic>
          <Byline>
            <KeyboardShortcutHint shortcut="Enter" action="add" />
            <ConfigurableShortcutHint action="confirm:no" context="Settings" fallback="Esc" description="cancel" />
          </Byline>
        </Text>
      </Box>
    </Box>;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJSZWFjdCIsInVzZUVmZmVjdCIsInVzZVJlZiIsInVzZVN0YXRlIiwiQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyIsImxvZ0V2ZW50IiwiQ29uZmlndXJhYmxlU2hvcnRjdXRIaW50IiwiQnlsaW5lIiwiS2V5Ym9hcmRTaG9ydGN1dEhpbnQiLCJTcGlubmVyIiwiVGV4dElucHV0IiwiQm94IiwiVGV4dCIsInRvRXJyb3IiLCJsb2dFcnJvciIsImNsZWFyQWxsQ2FjaGVzIiwiYWRkTWFya2V0cGxhY2VTb3VyY2UiLCJzYXZlTWFya2V0cGxhY2VUb1NldHRpbmdzIiwicGFyc2VNYXJrZXRwbGFjZUlucHV0IiwiVmlld1N0YXRlIiwiUHJvcHMiLCJpbnB1dFZhbHVlIiwic2V0SW5wdXRWYWx1ZSIsInZhbHVlIiwiY3Vyc29yT2Zmc2V0Iiwic2V0Q3Vyc29yT2Zmc2V0Iiwib2Zmc2V0IiwiZXJyb3IiLCJzZXRFcnJvciIsInJlc3VsdCIsInNldFJlc3VsdCIsInNldFZpZXdTdGF0ZSIsInN0YXRlIiwib25BZGRDb21wbGV0ZSIsIlByb21pc2UiLCJjbGlNb2RlIiwiQWRkTWFya2V0cGxhY2UiLCJSZWFjdE5vZGUiLCJoYXNBdHRlbXB0ZWRBdXRvQWRkIiwiaXNMb2FkaW5nIiwic2V0TG9hZGluZyIsInByb2dyZXNzTWVzc2FnZSIsInNldFByb2dyZXNzTWVzc2FnZSIsImhhbmRsZUFkZCIsImlucHV0IiwidHJpbSIsInBhcnNlZCIsIm5hbWUiLCJyZXNvbHZlZFNvdXJjZSIsIm1lc3NhZ2UiLCJzb3VyY2UiLCJzb3VyY2VUeXBlIiwicmVwbyIsInNvdXJjZV90eXBlIiwidHlwZSIsInRhcmdldE1hcmtldHBsYWNlIiwiZXJyIiwiY3VycmVudCJdLCJzb3VyY2VzIjpbIkFkZE1hcmtldHBsYWNlLnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBSZWFjdCBmcm9tICdyZWFjdCc7XG5pbXBvcnQgeyB1c2VFZmZlY3QsIHVzZVJlZiwgdXNlU3RhdGUgfSBmcm9tICdyZWFjdCc7XG5pbXBvcnQge1xuICB0eXBlIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gIGxvZ0V2ZW50LFxufSBmcm9tICdzcmMvc2VydmljZXMvYW5hbHl0aWNzL2luZGV4LmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYWJsZVNob3J0Y3V0SGludCB9IGZyb20gJy4uLy4uL2NvbXBvbmVudHMvQ29uZmlndXJhYmxlU2hvcnRjdXRIaW50LmpzJztcbmltcG9ydCB7IEJ5bGluZSB9IGZyb20gJy4uLy4uL2NvbXBvbmVudHMvZGVzaWduLXN5c3RlbS9CeWxpbmUuanMnO1xuaW1wb3J0IHsgS2V5Ym9hcmRTaG9ydGN1dEhpbnQgfSBmcm9tICcuLi8uLi9jb21wb25lbnRzL2Rlc2lnbi1zeXN0ZW0vS2V5Ym9hcmRTaG9ydGN1dEhpbnQuanMnO1xuaW1wb3J0IHsgU3Bpbm5lciB9IGZyb20gJy4uLy4uL2NvbXBvbmVudHMvU3Bpbm5lci5qcyc7XG5pbXBvcnQgVGV4dElucHV0IGZyb20gJy4uLy4uL2NvbXBvbmVudHMvVGV4dElucHV0LmpzJztcbmltcG9ydCB7IEJveCwgVGV4dCB9IGZyb20gJy4uLy4uL2NvcmUvaW5rLmpzJztcbmltcG9ydCB7IHRvRXJyb3IgfSBmcm9tICcuLi8uLi91dGlscy9lcnJvcnMuanMnO1xuaW1wb3J0IHsgbG9nRXJyb3IgfSBmcm9tICcuLi8uLi91dGlscy9sb2cuanMnO1xuaW1wb3J0IHsgY2xlYXJBbGxDYWNoZXMgfSBmcm9tICcuLi8uLi91dGlscy9wbHVnaW5zL2NhY2hlVXRpbHMuanMnO1xuaW1wb3J0IHsgYWRkTWFya2V0cGxhY2VTb3VyY2UsIHNhdmVNYXJrZXRwbGFjZVRvU2V0dGluZ3MgfSBmcm9tICcuLi8uLi91dGlscy9wbHVnaW5zL21hcmtldHBsYWNlTWFuYWdlci5qcyc7XG5pbXBvcnQgeyBwYXJzZU1hcmtldHBsYWNlSW5wdXQgfSBmcm9tICcuLi8uLi91dGlscy9wbHVnaW5zL3BhcnNlTWFya2V0cGxhY2VJbnB1dC5qcyc7XG5pbXBvcnQgdHlwZSB7IFZpZXdTdGF0ZSB9IGZyb20gJy4vdHlwZXMuanMnO1xuXG50eXBlIFByb3BzID0ge1xuICBpbnB1dFZhbHVlOiBzdHJpbmc7XG4gIHNldElucHV0VmFsdWU6ICh2YWx1ZTogc3RyaW5nKSA9PiB2b2lkO1xuICBjdXJzb3JPZmZzZXQ6IG51bWJlcjtcbiAgc2V0Q3Vyc29yT2Zmc2V0OiAob2Zmc2V0OiBudW1iZXIpID0+IHZvaWQ7XG4gIGVycm9yOiBzdHJpbmcgfCBudWxsO1xuICBzZXRFcnJvcjogKGVycm9yOiBzdHJpbmcgfCBudWxsKSA9PiB2b2lkO1xuICByZXN1bHQ6IHN0cmluZyB8IG51bGw7XG4gIHNldFJlc3VsdDogKHJlc3VsdDogc3RyaW5nIHwgbnVsbCkgPT4gdm9pZDtcbiAgc2V0Vmlld1N0YXRlOiAoc3RhdGU6IFZpZXdTdGF0ZSkgPT4gdm9pZDtcbiAgb25BZGRDb21wbGV0ZT86ICgpID0+IHZvaWQgfCBQcm9taXNlPHZvaWQ+O1xuICBjbGlNb2RlPzogYm9vbGVhbjtcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBBZGRNYXJrZXRwbGFjZSh7XG4gIGlucHV0VmFsdWUsXG4gIHNldElucHV0VmFsdWUsXG4gIGN1cnNvck9mZnNldCxcbiAgc2V0Q3Vyc29yT2Zmc2V0LFxuICBlcnJvcixcbiAgc2V0RXJyb3IsXG4gIHJlc3VsdCxcbiAgc2V0UmVzdWx0LFxuICBzZXRWaWV3U3RhdGUsXG4gIG9uQWRkQ29tcGxldGUsXG4gIGNsaU1vZGUgPSBmYWxzZSxcbn06IFByb3BzKTogUmVhY3QuUmVhY3RFbGVtZW50IHwgbnVsbCB7XG4gIGNvbnN0IGhhc0F0dGVtcHRlZEF1dG9BZGQgPSB1c2VSZWYoZmFsc2UpO1xuICBjb25zdCBbaXNMb2FkaW5nLCBzZXRMb2FkaW5nXSA9IHVzZVN0YXRlKGZhbHNlKTtcbiAgY29uc3QgW3Byb2dyZXNzTWVzc2FnZSwgc2V0UHJvZ3Jlc3NNZXNzYWdlXSA9IHVzZVN0YXRlPHN0cmluZz4oJycpO1xuXG4gIGNvbnN0IGhhbmRsZUFkZCA9IGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBpbnB1dCA9IGlucHV0VmFsdWUudHJpbSgpO1xuICAgIGlmICghaW5wdXQpIHtcbiAgICAgIHNldEVycm9yKCdQbGVhc2UgZW50ZXIgYSBtYXJrZXRwbGFjZSBzb3VyY2UnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBwYXJzZWQgPSBhd2FpdCBwYXJzZU1hcmtldHBsYWNlSW5wdXQoaW5wdXQpO1xuICAgIGlmICghcGFyc2VkKSB7XG4gICAgICBzZXRFcnJvcignSW52YWxpZCBtYXJrZXRwbGFjZSBzb3VyY2UgZm9ybWF0LiBUcnk6IG93bmVyL3JlcG8sIGh0dHBzOi8vLi4uLCBvciAuL3BhdGgnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBDaGVjayBpZiBwYXJzZU1hcmtldHBsYWNlSW5wdXQgcmV0dXJuZWQgYW4gZXJyb3JcbiAgICBpZiAoJ2Vycm9yJyBpbiBwYXJzZWQpIHtcbiAgICAgIHNldEVycm9yKHBhcnNlZC5lcnJvcik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgc2V0RXJyb3IobnVsbCk7XG4gICAgdHJ5IHtcbiAgICAgIHNldExvYWRpbmcodHJ1ZSk7XG4gICAgICBzZXRQcm9ncmVzc01lc3NhZ2UoJycpO1xuICAgICAgY29uc3QgeyBuYW1lLCByZXNvbHZlZFNvdXJjZSB9ID0gYXdhaXQgYWRkTWFya2V0cGxhY2VTb3VyY2UocGFyc2VkLCAobWVzc2FnZSkgPT4ge1xuICAgICAgICBzZXRQcm9ncmVzc01lc3NhZ2UobWVzc2FnZSk7XG4gICAgICB9KTtcblxuICAgICAgc2F2ZU1hcmtldHBsYWNlVG9TZXR0aW5ncyhuYW1lLCB7IHNvdXJjZTogcmVzb2x2ZWRTb3VyY2UgfSk7XG4gICAgICBjbGVhckFsbENhY2hlcygpO1xuXG4gICAgICBsZXQgc291cmNlVHlwZSA9IHBhcnNlZC5zb3VyY2U7XG4gICAgICBpZiAocGFyc2VkLnNvdXJjZSA9PT0gJ2dpdGh1YicpIHtcbiAgICAgICAgc291cmNlVHlwZSA9IHBhcnNlZC5yZXBvIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFM7XG4gICAgICB9XG5cbiAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9tYXJrZXRwbGFjZV9hZGRlZCcsIHtcbiAgICAgICAgc291cmNlX3R5cGU6IHNvdXJjZVR5cGUgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAob25BZGRDb21wbGV0ZSkge1xuICAgICAgICBhd2FpdCBvbkFkZENvbXBsZXRlKCk7XG4gICAgICB9XG4gICAgICBzZXRMb2FkaW5nKGZhbHNlKTtcblxuICAgICAgaWYgKGNsaU1vZGUpIHtcbiAgICAgICAgLy8gSW4gQ0xJIG1vZGUsIHNldCByZXN1bHQgdG8gdHJpZ2dlciBjb21wbGV0aW9uXG4gICAgICAgIHNldFJlc3VsdChgU3VjY2Vzc2Z1bGx5IGFkZGVkIG1hcmtldHBsYWNlOiAke25hbWV9YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBJbiBpbnRlcmFjdGl2ZSBtb2RlLCBzd2l0Y2ggdG8gYnJvd3NlIHZpZXdcbiAgICAgICAgc2V0Vmlld1N0YXRlKHtcbiAgICAgICAgICB0eXBlOiAnYnJvd3NlLW1hcmtldHBsYWNlJyxcbiAgICAgICAgICB0YXJnZXRNYXJrZXRwbGFjZTogbmFtZSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjb25zdCBlcnJvciA9IHRvRXJyb3IoZXJyKTtcbiAgICAgIGxvZ0Vycm9yKGVycm9yKTtcbiAgICAgIHNldEVycm9yKGVycm9yLm1lc3NhZ2UpO1xuICAgICAgaWYgKGNsaU1vZGUpIHtcbiAgICAgICAgLy8gSW4gQ0xJIG1vZGUsIHNldCByZXN1bHQgd2l0aCBlcnJvciB0byB0cmlnZ2VyIGNvbXBsZXRpb25cbiAgICAgICAgc2V0UmVzdWx0KGBFcnJvcjogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgfVxuICAgICAgc2V0TG9hZGluZyhmYWxzZSk7XG4gICAgICBzZXRSZXN1bHQobnVsbCk7XG4gICAgfVxuICB9O1xuXG4gIC8vIEF1dG8tYWRkIGlmIGlucHV0VmFsdWUgaXMgcHJvdmlkZWRcbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoaW5wdXRWYWx1ZSAmJiAhaGFzQXR0ZW1wdGVkQXV0b0FkZC5jdXJyZW50ICYmICFlcnJvciAmJiAhcmVzdWx0KSB7XG4gICAgICBoYXNBdHRlbXB0ZWRBdXRvQWRkLmN1cnJlbnQgPSB0cnVlO1xuICAgICAgdm9pZCBoYW5kbGVBZCgpO1xuICAgIH1cbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgcmVhY3QtaG9va3MvZXhoYXVzdGl2ZS1kZXBzXG4gICAgLy8gYmlvbWUtaWdub3JlIGxpbnQvY29ycmVjdG5lc3MvdXNlRXhoYXVzdGl2ZURlcGVuZGVuY2llczogaW50ZW50aW9uYWxcbiAgfSwgW10pOyAvLyBPbmx5IHJ1biBvbmNlIG9uIG1vdW50XG5cbiAgcmV0dXJuIChcbiAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIHBhZGRpbmdYPXsxfSBib3JkZXJTdHlsZT1cInJvdW5kXCI+XG4gICAgICAgIDxCb3ggbWFyZ2luQm90dG9tPXsxfT5cbiAgICAgICAgICA8VGV4dCBib2xkPkFkZCBNYXJrZXRwbGFjZTwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICAgIDxUZXh0PkVudGVyIG1hcmtldHBsYWNlIHNvdXJjZTo8L1RleHQ+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+RXhhbXBsZXM6PC9UZXh0PlxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPiDDlyBvd25lci9yZXBvIChHaXRIdWIpPC9UZXh0PlxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPiDDlyBnaXRAZ2l0aHViLmNvbTpvd25lci9yZXBvLmdpdCAoU1NIKTwvVGV4dD5cbiAgICAgICAgICA8VGV4dCBkaW1Db2xvcj4gQ8OXIGh0dHBzOi8vZXhhbXBsZS5jb20vbWFya2V0cGxhY2UuanNvbjwvVGV4dD5cbiAgICAgICAgICA8VGV4dCBkaW1Db2xvcj4gQ8OXIC4vcGF0aC90by9tYXJrZXRwbGFjZTwvVGV4dD5cbiAgICAgICAgICA8Qm94IG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgICA8VGV4dElucHV0XG4gICAgICAgICAgICAgIHZhbHVlPXtpbnB1dFZhbHVlfVxuICAgICAgICAgICAgICBvbkNoYW5nZT17c2V0SW5wdXRWYWx1ZX1cbiAgICAgICAgICAgICAgb25TdWJtaXQ9e2hhbmRsZUFkZH1cbiAgICAgICAgICAgICAgY29sdW1ucz17ODB9XG4gICAgICAgICAgICAgIGN1cnNvck9mZnNldD17Y3Vyc29yT2Zmc2V0fVxuICAgICAgICAgICAgICBvbkNoYW5nZUN1cnNvck9mZnNldD17c2V0Q3Vyc29yT2Zmc2V0fVxuICAgICAgICAgICAgICBmb2N1c1xuICAgICAgICAgICAgICBzaG93Q3Vyc29yXG4gICAgICAgICAgICAvPlxuICAgICAgICAgIDwvQm94PlxuICAgICAgICA8L0JveD5cbiAgICAgICAge2lzTG9hZGluZyAmJiAoXG4gICAgICAgICAgPEJveCBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICAgICAgPFNwaW5uZXIgLz5cbiAgICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAgICB7cHJvZ3Jlc3NNZXNzYWdlIHx8ICdBZGRpbmcgbWFya2V0cGxhY2UgdG8gY29uZmlndXJhdGlvbuK6nicsXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICl9XG4gICAgICAgIHtlcnJvciAmJiAoXG4gICAgICAgICAgPEJveCBtYXJnaW5Ub3A9ezF9PlxuICAgICAgICAgICAgPFRleHQgY29sb3I9XCJlcnJvclwiPntlcnJvcn08L1RleHQ+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICl9XG4gICAgICAgIHtyZXN1bHQgJiYgKFxuICAgICAgICAgIDxCb3ggbWFyZ2luVG9wPXsxfT5cbiAgICAgICAgICAgIDxUZXh0PntyZXN1bHR9PC9UZXh0PlxuICAgICAgICAgIDwvQm94PlxuICAgICAgICApfVxuICAgICAgPC9Cb3g+XG4gICAgICA8Qm94IG1hcmdpbkxlZnQ9ezN9PlxuICAgICAgICA8VGV4dCBkaW1Db2xvciBpdGFsaWM+XG4gICAgICAgICAgPEJ5bGluZT5cbiAgICAgICAgICAgIDxLZXlib2FyZFNob3J0Y3V0SGludCBzaG9ydGN1dD1cIkVudGVyXCIgYWN0aW9uPVwiYWRkXCIgLz5cbiAgICAgICAgICAgIDxDb25maWd1cmFibGVTaG9ydGN1dEhpbnRcbiAgICAgICAgICAgICAgYWN0aW9uPVwiY29uZmlybTpub1wiXG4gICAgICAgICAgICAgIGNvbnRleHQ9XCJTZXR0aW5nc1wiXG4gICAgICAgICAgICAgIGZhbGxiYWNrPVwiRXNjXCJcbiAgICAgICAgICAgICAgZGVzY3JpcHRpb249XCJjYW5jZWxcIlxuICAgICAgICAgICAgLz5cbiAgICAgICAgICA8L0J5bGluZT5cbiAgICAgICAgPC9UZXh0PlxuICAgICAgPC9Cb3g+XG4gICAgPC9Cb3g+XG4gICk7XG59XG4ifQ==
