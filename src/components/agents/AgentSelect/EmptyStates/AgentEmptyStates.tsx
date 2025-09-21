// src/components/agents/AgentEmptyStates.tsx
import React from 'react'
import AdaptiveTutorialEmptyState from './AdaptiveTutorialEmptyState'

interface AgentEmptyStatesProps {
  searchQuery: string
  totalAgents: number
  onClearSearch: () => void
  onCreateAgent: () => void
}

const AgentEmptyStates: React.FC<AgentEmptyStatesProps> = ({
  searchQuery,
  totalAgents,
  onClearSearch,
  onCreateAgent
}) => {
  return (
    <AdaptiveTutorialEmptyState
      searchQuery={searchQuery}
      totalAgents={totalAgents}
      onClearSearch={onClearSearch}
      onCreateAgent={onCreateAgent}
    />
  )
}

export default AgentEmptyStates