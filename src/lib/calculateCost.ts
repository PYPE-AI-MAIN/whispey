// Mock Cost Calculation - No Database Required!

async function getUsdToInr(onDate: string | Date): Promise<number> {
  // Mock: return fixed exchange rate
  return 83.0
}

export async function fetchRate(pricingColumn: string, table: string, filters: Record<string, any>): Promise<number | null> {
  // Mock: return sample rates
  const mockRates: Record<string, number> = {
    'input_usd_per_million': 0.50,
    'output_usd_per_million': 1.50,
    'cost_usd_per_unit': 0.006
  }
  
  return mockRates[pricingColumn] || 0.01
}

export async function calculateSTTCost(duration: number, provider: string = 'openai'): Promise<number> {
  // Mock: $0.006 per minute
  const minutes = Math.ceil(duration / 60)
  return minutes * 0.006
}

export async function calculateTTSCost(characters: number, provider: string = 'openai'): Promise<number> {
  // Mock: $0.015 per 1K characters
  return (characters / 1000) * 0.015
}

export async function calculateLLMCost(inputTokens: number, outputTokens: number, model: string = 'gpt-3.5-turbo'): Promise<number> {
  // Mock rates
  const inputCost = (inputTokens / 1000000) * 0.50
  const outputCost = (outputTokens / 1000000) * 1.50
  return inputCost + outputCost
}