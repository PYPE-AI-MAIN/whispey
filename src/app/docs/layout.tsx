import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { RootProvider } from 'fumadocs-ui/provider';
import type { ReactNode } from 'react';

import 'fumadocs-ui/style.css'; // Keep this - it has essential styles
import './docs.css'; // Your customizations

const baseOptions = {
  nav: {
    title: 'Whispey Documentation',
  },
  disableThemeSwitch: true,
};

export default function DocsLayoutComponent({ children }: { children: ReactNode }) {
  return (
    <RootProvider 
      theme={{
        enabled: false,
      }}
    >
      <div className="fumadocs-container min-h-screen">
        <DocsLayout tree={source.pageTree} {...baseOptions}>
          {children}
        </DocsLayout>
      </div>
    </RootProvider>
  );
}