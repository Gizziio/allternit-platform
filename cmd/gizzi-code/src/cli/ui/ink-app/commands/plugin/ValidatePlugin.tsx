import figures from 'figures';
import * as React from 'react';
import { useEffect } from 'react';
import { Box, Text } from '../../ink';
import { errorMessage } from '../../utils/errors';
import { logError } from '../../utils/log';
import { validateManifest } from '../../utils/plugins/validatePlugin';
import { plural } from '../../utils/stringUtils';
type Props = {
  onComplete: (result?: string) => void;
  path?: string;
};
export function ValidatePlugin({
    onComplete,
    path
}: Props) {
  const t1 = () => {
      const runValidation = async function runValidation() {
        if (!path) {
          onComplete("Usage: /plugin validate <path>\n\nValidate a plugin or marketplace manifest file or directory.\n\nExamples:\n  /plugin validate .claude-plugin/plugin.json\n  /plugin validate /path/to/plugin-directory\n  /plugin validate .\n\nWhen given a directory, automatically validates .claude-plugin/marketplace.json\nor .claude-plugin/plugin.json (prefers marketplace if both exist).\n\nOr from the command line:\n  claude plugin validate <path>");
          return;
        }
        ;
        try {
          const result = await validateManifest(path);
          let output = "";
          output = output + `Validating ${result.fileType} manifest: ${result.filePath}\n\n`;
          output;
          if (result.errors.length > 0) {
            output = output + `${figures.cross} Found ${result.errors.length} ${plural(result.errors.length, "error")}:\n\n`;
            output;
            result.errors.forEach(error_0 => {
              output = output + `  ${figures.pointer} ${error_0.path}: ${error_0.message}\n`;
              output;
            });
            output = output + "\n";
            output;
          }
          if (result.warnings.length > 0) {
            output = output + `${figures.warning} Found ${result.warnings.length} ${plural(result.warnings.length, "warning")}:\n\n`;
            output;
            result.warnings.forEach(warning => {
              output = output + `  ${figures.pointer} ${warning.path}: ${warning.message}\n`;
              output;
            });
            output = output + "\n";
            output;
          }
          if (result.success) {
            if (result.warnings.length > 0) {
              output = output + `${figures.tick} Validation passed with warnings\n`;
              output;
            } else {
              output = output + `${figures.tick} Validation passed\n`;
              output;
            }
            process.exitCode = 0;
          } else {
            output = output + `${figures.cross} Validation failed\n`;
            output;
            process.exitCode = 1;
          }
          onComplete(output);
        } catch (t3) {
          const error = t3;
          process.exitCode = 2;
          logError(error);
          onComplete(`${figures.cross} Unexpected error during validation: ${errorMessage(error)}`);
        }
      };
      runValidation();
    };
  const t2 = [onComplete, path];

  useEffect(t1, t2);
  const t3 = <Box flexDirection="column"><Text>Running validation...</Text></Box>;

  return t3;
}
