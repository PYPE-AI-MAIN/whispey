const sidebars = {
  docs: [
    'index',
    'quick-start',
    {type: 'category', label: 'SDK', items: ['sdk/setup', 'sdk/recording-urls', 'sdk/bug-reporting', 'sdk/healthbench-evaluation', 'sdk/features']},
    {type: 'category', label: 'Workflows', items: ['workflows/overview', 'workflows/quickstart', 'workflows/editor-tour', 'workflows/steps', 'workflows/connections', 'workflows/global-rules', 'workflows/variables-and-knowledge', 'workflows/voice-and-behavior', 'workflows/test-deploy', 'workflows/troubleshooting']},
    'configuration',
    'complete-implementation',
    'observability',
    'examples',
    'campaign-logs',
  ],
};

export default sidebars;
