export const getAgentPlatform = (agent: any): 'vapi' | 'livekit' | 'unknown' => {
    console.log({agent})
    if (agent?.agent_type === 'vapi' || 
        agent?.configuration?.vapi?.assistantId || 
        agent?.vapi_api_key_encrypted) {
      return 'vapi'
    }
    else {
      return 'livekit'
    }
}