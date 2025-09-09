import defaultComponents from "fumadocs-ui/mdx"
import type { MDXComponents } from "mdx/types"
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...defaultComponents,
    // Add the code block handling
    pre: ({ ref: _ref, ...props }) => (
      <CodeBlock keepBackground {...props}>
        <Pre>{props.children}</Pre>
      </CodeBlock>
    ),
    ...components,
    // Can add more components here...
  }
}