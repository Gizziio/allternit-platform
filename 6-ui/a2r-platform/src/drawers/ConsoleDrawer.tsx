import React from 'react';
import { DrawerRoot } from '../views/code/ConsoleDrawer/DrawerRoot';

// The global ConsoleDrawer now delegates to the modular DrawerRoot
export function ConsoleDrawer() {
  return <DrawerRoot />;
}
