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
  onAgentClick: (agent: Agent) => void
  onCopyAgentId: (agentId: string, e: React.MouseEvent) => void
  onDeleteAgent: (agent: Agent) => void
}

const AgentList: React.FC<AgentListProps> = ({
  agents,
  viewMode,
  selectedAgent,
  copiedAgentId,
  onAgentClick,
  onCopyAgentId,
  onDeleteAgent
}) => {
  if (viewMode === 'list') {
    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {agents.map((agent, index) => (
          <AgentListItem
            key={agent.id}
            agent={agent}
            viewMode="list"
            isSelected={selectedAgent === agent.id}
            isCopied={copiedAgentId === agent.id}
            isLastItem={index === agents.length - 1}
            onClick={() => onAgentClick(agent)}
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
          onClick={() => onAgentClick(agent)}
          onCopyId={(e) => onCopyAgentId(agent.id, e)}
          onDelete={() => onDeleteAgent(agent)}
        />
      ))}
    </div>
  )
}

export default AgentList