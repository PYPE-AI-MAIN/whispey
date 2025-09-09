import { defineConfig, defineDocs } from 'fumadocs-mdx/config';

export default defineConfig({
  mdxOptions: {
    // Enable proper code block processing
    remarkCodeTabOptions: {
      parseMdx: true,
    },
  },
});

export const docs = defineDocs({
  dir: 'content/docs',
});
