/**
 * Docmost Wiki Edit View
 * Direct surface for editing wiki pages.
 */

import React from 'react';
import { WikiView } from './WikiView';

export const WikiEditView: React.FC = () => {
  return <WikiView defaultEdit />;
};

export default WikiEditView;
