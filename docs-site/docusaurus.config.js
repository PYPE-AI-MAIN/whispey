import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Whispey Docs',
  tagline: 'Observability for voice AI agents, by Pype',
  favicon: 'img/favicon.ico',
  url: 'https://docs.whispey.pypeai.com',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  stylesheets: [
    {href: 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap', type: 'text/css'},
  ],
  i18n: {defaultLocale: 'en', locales: ['en']},
  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {path: 'content', routeBasePath: '/', sidebarPath: './sidebars.js'},
        blog: false,
        pages: false,
        theme: {customCss: './src/css/custom.css'},
      }),
    ],
  ],
  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {defaultMode: 'light', respectPrefersColorScheme: false},
      navbar: {
        title: 'Whispey Docs',
        logo: {alt: 'Whispey', src: 'img/logo.svg', srcDark: 'img/logo-dark.svg'},
        items: [
          {to: '/workflows/overview', label: 'Workflows', position: 'left'},
          {to: '/agent-config/overview', label: 'Agents', position: 'left'},
          {to: '/analytics/overview', label: 'Analytics', position: 'left'},
          {to: '/quick-start', label: 'SDK', position: 'left'},
          {href: 'https://whispey.xyz', label: 'Open Whispey', position: 'right', className: 'wp-nav-cta'},
        ],
      },
      footer: {copyright: `© ${new Date().getFullYear()} Pype`},
      prism: {theme: prismThemes.github, darkTheme: prismThemes.dracula, additionalLanguages: ['python', 'bash', 'json']},
    }),
};

export default config;
