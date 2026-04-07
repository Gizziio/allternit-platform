import { Box, Text } from '../../ink';

export function GateOverridesWarning(): React.ReactElement {
  return (
    <Box paddingLeft={2} flexDirection="column">
      <Text color="warning">[Gate Overrides Active]</Text>
    </Box>
  );
}
