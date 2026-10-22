import {themes as prismThemes} from 'prism-react-renderer';

// '/' standalone, '/docs/' when built into the Whispey app (which serves it behind sign-in).
const BASE_URL = process.env.DOCS_BASE_URL || '/';
// Pages under the SDK reference tab; everything else belongs to Documentation.
const SDK_PAGES = 'sdk|configuration|complete-implementation|observability|examples|quick-start';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Whispey Docs',
  tagline: 'AI voice agents for healthcare, by Pype',
  favicon: 'img/favicon.ico',
  // DOCS_BASE_URL=/docs/ when the site is built into the Whispey app, which serves it behind sign-in.
  url: process.env.DOCS_SITE_URL || 'https://www.whispey.xyz',
  baseUrl: BASE_URL,
  // Not noIndex: the docs search skips pages marked noindex. Crawlers can't reach the docs
  // (signed-in only), and the app's /docs route already sends X-Robots-Tag: noindex.
  onBrokenLinks: 'throw',
  stylesheets: [
    {href: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap', type: 'text/css'},
  ],
  i18n: {defaultLocale: 'en', locales: ['en']},
  clientModules: ['./src/clientModules/searchShortcut.js', './src/clientModules/reloadOnStaleChunk.js'],
  // Offline full-text search: the index is built with the site, no service needed.
  themes: [
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        docsRouteBasePath: '/',
        indexBlog: false,
        indexPages: false,
        highlightSearchTermsOnTargetPage: false,
        searchBarShortcutHint: false,
        searchResultLimits: 8,
      },
    ],
  ],
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
      colorMode: {defaultMode: 'light', respectPrefersColorScheme: true},
      docs: {sidebar: {autoCollapseCategories: false}},
      tableOfContents: {minHeadingLevel: 2, maxHeadingLevel: 3},
      navbar: {
        title: 'Whispey Docs',
        logo: {alt: 'Whispey', src: 'img/logo.svg', srcDark: 'img/logo-dark.svg'},
        items: [
          {to: '/', label: 'Documentation', position: 'left', activeBaseRegex: `^${BASE_URL}(?!${SDK_PAGES}|mcp)`},
          {to: '/quick-start', label: 'SDK reference', position: 'left', activeBaseRegex: `^${BASE_URL}(${SDK_PAGES})`},
          {to: '/mcp/quickstart', label: 'Build with Claude', position: 'left', activeBaseRegex: `^${BASE_URL}mcp`},
          {type: 'search', position: 'right'},
          {type: 'html', position: 'right', value: '<a class="navbar__item navbar__link wp-nav-cta" href="/">Open Whispey</a>'},
        ],
      },
      footer: {copyright: `© ${new Date().getFullYear()} Pype`},
      prism: {theme: prismThemes.github, darkTheme: prismThemes.nightOwl, additionalLanguages: ['python', 'bash', 'json']},
    }),
};

export default config;
