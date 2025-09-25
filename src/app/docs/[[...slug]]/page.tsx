// src/app/docs/[...slug]/page.tsx
import { source } from '@/lib/source';
import type { Metadata } from 'next';
import { DocsPage, DocsBody } from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';
import defaultComponents from 'fumadocs-ui/mdx';
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';

// Force the components
const components = {
  ...defaultComponents,
  pre: ({ ref: _ref, ...props }: any) => {
    return (
      <CodeBlock keepBackground {...props}>
        <Pre>{props.children}</Pre>
      </CodeBlock>
    );
  },
};

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);

  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsBody>
        <h1>{page.data.title}</h1>
        <MDX components={components} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);

  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  };
}