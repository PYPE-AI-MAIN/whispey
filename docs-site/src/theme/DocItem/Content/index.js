// Page header in the style of the rest of the site: the section the page is
// in, the title, the one-line description from front matter, and page actions.
// Based on @docusaurus/theme-classic's DocItem/Content.
import React from 'react';
import clsx from 'clsx';
import {ThemeClassNames} from '@docusaurus/theme-common';
import {useDoc, useSidebarBreadcrumbs} from '@docusaurus/plugin-content-docs/client';
import Heading from '@theme/Heading';
import MDXContent from '@theme/MDXContent';
import PageActions from '@site/src/components/PageActions';

/** The sidebar section this page sits in, e.g. "Analytics and quality". */
function useSectionLabel() {
  const crumbs = useSidebarBreadcrumbs();
  if (!crumbs || crumbs.length < 2) return null;
  return crumbs[crumbs.length - 2]?.label ?? null;
}

export default function DocItemContent({children}) {
  const {metadata, frontMatter, contentTitle} = useDoc();
  const section = useSectionLabel();
  // Pages with their own "# Title" in the content keep it; the rest get one here.
  const title = !frontMatter.hide_title && contentTitle === undefined ? metadata.title : null;
  const description = frontMatter.hide_description ? null : frontMatter.description;

  return (
    <div className={clsx(ThemeClassNames.docs.docMarkdown, 'markdown')}>
      {title && (
        <header className="wp-page-header">
          {section && <p className="wp-page-section">{section}</p>}
          <div className="wp-page-title-row">
            <Heading as="h1">{title}</Heading>
            <PageActions />
          </div>
          {description && <p className="wp-page-description">{description}</p>}
        </header>
      )}
      <MDXContent>{children}</MDXContent>
    </div>
  );
}
