import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Whispey Docs',
  tagline: 'Observability for voice AI agents, by Pype',
  favicon: 'img/favicon.ico',
  url: 'https://docs.whispey.pypeai.com',
  baseUrl: '/',
  onBrokenLinks: 'throw',
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
      colorMode: {respectPrefersColorScheme: true},
      navbar: {
        title: 'Whispey Docs',
        logo: {alt: 'Whispey', src: 'img/logo.svg', srcDark: 'img/logo-dark.svg'},
      },
      footer: {copyright: `© ${new Date().getFullYear()} Pype`},
      prism: {theme: prismThemes.github, darkTheme: prismThemes.dracula, additionalLanguages: ['python', 'bash', 'json']},
    }),
};

export default config;
