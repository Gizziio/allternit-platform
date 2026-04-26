const config = {
  title: 'Allternit Universal Plugin SDK',
  tagline: 'Write once. Run on any LLM platform.',
  url: 'https://plugins.allternit.com',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon.ico',
  organizationName: 'allternit',
  projectName: 'plugin-sdk',
  
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: 'https://github.com/allternit/plugin-sdk/tree/main/website/',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],

  themeConfig: {
    navbar: {
      title: 'Plugin SDK',
      logo: {
        alt: 'Allternit Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'doc',
          docId: 'intro',
          position: 'left',
          label: 'Docs',
        },
        {
          to: '/docs/platforms/claude',
          label: 'Platforms',
          position: 'left',
        },
        {
          href: 'https://github.com/allternit/plugin-sdk',
          label: 'GitHub',
          position: 'right',
        },
        {
          href: 'https://www.npmjs.com/package/@allternit/plugin-sdk',
          label: 'NPM',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Quick Start', to: '/docs/quickstart' },
            { label: 'Architecture', to: '/docs/architecture' },
            { label: 'Platform Guides', to: '/docs/platforms/claude' },
          ],
        },
        {
          title: 'Community',
          items: [
            { label: 'GitHub', href: 'https://github.com/allternit/plugin-sdk' },
            { label: 'Discussions', href: 'https://github.com/allternit/plugin-sdk/discussions' },
          ],
        },
        {
          title: 'More',
          items: [
            { label: 'NPM Package', href: 'https://www.npmjs.com/package/@allternit/plugin-sdk' },
            { label: 'Allternit', href: 'https://allternit.com' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Allternit. Built with Docusaurus.`,
    },
    prism: {
      theme: require('prism-react-renderer').themes.github,
      darkTheme: require('prism-react-renderer').themes.dracula,
    },
  },
};

module.exports = config;
