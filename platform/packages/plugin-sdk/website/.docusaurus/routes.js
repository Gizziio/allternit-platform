import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/docs',
    component: ComponentCreator('/docs', '8f1'),
    routes: [
      {
        path: '/docs',
        component: ComponentCreator('/docs', 'c4f'),
        routes: [
          {
            path: '/docs',
            component: ComponentCreator('/docs', '5d8'),
            routes: [
              {
                path: '/docs/intro',
                component: ComponentCreator('/docs/intro', 'f79'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/introduction',
                component: ComponentCreator('/docs/introduction', 'fca'),
                exact: true
              },
              {
                path: '/docs/platforms/claude',
                component: ComponentCreator('/docs/platforms/claude', 'c01'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/platforms/codex',
                component: ComponentCreator('/docs/platforms/codex', '6cd'),
                exact: true,
                sidebar: "docsSidebar"
              },
              {
                path: '/docs/quickstart',
                component: ComponentCreator('/docs/quickstart', '177'),
                exact: true,
                sidebar: "docsSidebar"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '/',
    component: ComponentCreator('/', 'a9e'),
    exact: true
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
