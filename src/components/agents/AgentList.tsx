import React from 'react'
import AgentListItem from './AgentListItem'

interface Agent {
  id: string
  name: string
  agent_type: string
  configuration: any
  environment: string
  created_at: string
  is_active: boolean
  project_id: string
}

interface AgentListProps {
  agents: Agent[]
  viewMode: 'grid' | 'list'
  selectedAgent: string | null
  copiedAgentId: string | null
  projectId: string
  onCopyAgentId: (agentId: string, e: React.MouseEvent) => void
  onDeleteAgent: (agent: Agent) => void
}

const AgentList: React.FC<AgentListProps> = ({
  agents,
  viewMode,
  selectedAgent,
  copiedAgentId,
  projectId,
  onCopyAgentId,
  onDeleteAgent
}) => {
  if (viewMode === 'list') {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        {agents.map((agent, index) => (
          <AgentListItem
            key={agent.id}
            agent={agent}
            viewMode="list"
            isSelected={selectedAgent === agent.id}
            isCopied={copiedAgentId === agent.id}
            isLastItem={index === agents.length - 1}
            projectId={projectId}
            onCopyId={(e) => onCopyAgentId(agent.id, e)}
            onDelete={() => onDeleteAgent(agent)}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
      {agents.map((agent) => (
        <AgentListItem
          key={agent.id}
          agent={agent}
          viewMode="grid"
          isSelected={selectedAgent === agent.id}
          isCopied={copiedAgentId === agent.id}
          isLastItem={false}
          projectId={projectId}
          onCopyId={(e) => onCopyAgentId(agent.id, e)}
          onDelete={() => onDeleteAgent(agent)}
        />
      ))}
    </div>
  )
}

export default AgentList
