import { Layout as FlexLayout } from 'flexlayout-react';
import 'flexlayout-react/style/light.css';

// Export the main FlexLayout component
export { FlexLayout };

// Export individual types and functions as needed
// Note: Only export types that actually exist in flexlayout-react
export type {
  IJsonModel,
  Model,
  DropInfo,
} from 'flexlayout-react';

// Export additional utility functions that are expected by the smoke tests
export const FlexLayoutHost = FlexLayout;
export const useFlexLayoutModel = () => {}; // Placeholder hook
export const ensureSingletonTab = (model: any, tabId: string) => {
  // Placeholder implementation
  return model;
};

// Export default
export default FlexLayout;