# sdk/whispey/pricing_calculator.py
import logging
from typing import Dict, Optional, Tuple, Any

logger = logging.getLogger("whispey-sdk")

class ModelPricingCalculator:
    """Dynamic pricing calculator for AI models"""
    
    def __init__(self):
        # Updated pricing as of January 2025 (per 1M tokens unless specified)
        self.pricing_database = {
            # OpenAI Models
            'gpt-4o': {
                'provider': 'openai',
                'input_cost_per_1m': 2.50,   # $2.50 per 1M input tokens
                'output_cost_per_1m': 10.00,  # $10.00 per 1M output tokens
                'type': 'llm'
            },
            'gpt-4o-mini': {
                'provider': 'openai',
                'input_cost_per_1m': 0.15,   # $0.15 per 1M input tokens
                'output_cost_per_1m': 0.60,   # $0.60 per 1M output tokens
                'type': 'llm'
            },
            'gpt-4-turbo': {
                'provider': 'openai',
                'input_cost_per_1m': 10.00,
                'output_cost_per_1m': 30.00,
                'type': 'llm'
            },
            'gpt-3.5-turbo': {
                'provider': 'openai',
                'input_cost_per_1m': 0.50,
                'output_cost_per_1m': 1.50,
                'type': 'llm'
            },
            
            # Anthropic Models
            'claude-3-5-sonnet-20241022': {
                'provider': 'anthropic',
                'input_cost_per_1m': 3.00,
                'output_cost_per_1m': 15.00,
                'type': 'llm'
            },
            'claude-3-5-haiku-20241022': {
                'provider': 'anthropic',
                'input_cost_per_1m': 1.00,
                'output_cost_per_1m': 5.00,
                'type': 'llm'
            },
            'claude-3-opus-20240229': {
                'provider': 'anthropic',
                'input_cost_per_1m': 15.00,
                'output_cost_per_1m': 75.00,
                'type': 'llm'
            },
            
            # Google Models
            'gemini-1.5-pro': {
                'provider': 'google',
                'input_cost_per_1m': 1.25,
                'output_cost_per_1m': 5.00,
                'type': 'llm'
            },
            'gemini-1.5-flash': {
                'provider': 'google',
                'input_cost_per_1m': 0.075,
                'output_cost_per_1m': 0.30,
                'type': 'llm'
            },
            
            # TTS Models (per 1M characters)
            'tts-1': {
                'provider': 'openai',
                'cost_per_1m_chars': 15.00,  # $15.00 per 1M characters
                'type': 'tts'
            },
            'tts-1-hd': {
                'provider': 'openai',
                'cost_per_1m_chars': 30.00,  # $30.00 per 1M characters
                'type': 'tts'
            },
            'eleven_labs_v1': {
                'provider': 'elevenlabs',
                'cost_per_1m_chars': 30.00,  # Estimated
                'type': 'tts'
            },
            'cartesia-sonic': {
                'provider': 'cartesia',
                'cost_per_1m_chars': 45.00,  # Real-time TTS premium
                'type': 'tts'
            },
            
            # STT Models (per hour)
            'whisper-1': {
                'provider': 'openai',
                'cost_per_hour': 0.006,  # $0.006 per minute = $0.36 per hour
                'type': 'stt'
            },
            'deepgram-nova-2': {
                'provider': 'deepgram',
                'cost_per_hour': 0.0043,  # $0.0043 per minute
                'type': 'stt'
            },
            'azure-stt': {
                'provider': 'azure',
                'cost_per_hour': 1.00,  # $1.00 per hour
                'type': 'stt'
            }
        }
        
        # Fallback pricing for unknown models
        self.fallback_pricing = {
            'llm': {
                'input_cost_per_1m': 1.00,   # Conservative fallback
                'output_cost_per_1m': 3.00,
            },
            'tts': {
                'cost_per_1m_chars': 20.00,
            },
            'stt': {
                'cost_per_hour': 0.50,
            }
        }

    def get_model_info(self, model_name: str) -> Optional[Dict]:
        """Get pricing info for a model"""
        if not model_name:
            return None
            
        # Direct lookup
        if model_name in self.pricing_database:
            return self.pricing_database[model_name]
        
        # Fuzzy matching for model variants
        model_lower = model_name.lower()
        
        # Try partial matches
        for db_model, info in self.pricing_database.items():
            if db_model.lower() in model_lower or model_lower in db_model.lower():
                logger.info(f"💰 Fuzzy matched '{model_name}' to '{db_model}' for pricing")
                return info
        
        # Try provider-based matching
        provider_matches = {
            'gpt': 'gpt-4o-mini',  # Default OpenAI fallback
            'claude': 'claude-3-5-haiku-20241022',  # Default Anthropic fallback
            'gemini': 'gemini-1.5-flash',  # Default Google fallback
        }
        
        for provider_key, default_model in provider_matches.items():
            if provider_key in model_lower:
                logger.warning(f"💰 Using provider fallback: '{model_name}' → '{default_model}'")
                return self.pricing_database.get(default_model)
        
        return None

    def calculate_llm_cost(self, model_name: str, prompt_tokens: int, completion_tokens: int) -> Tuple[float, str]:
        """Calculate LLM cost based on actual model and tokens"""
        
        model_info = self.get_model_info(model_name)
        
        if model_info and model_info['type'] == 'llm':
            input_cost = (prompt_tokens * model_info['input_cost_per_1m']) / 1_000_000
            output_cost = (completion_tokens * model_info['output_cost_per_1m']) / 1_000_000
            total_cost = input_cost + output_cost
            
            logger.info(f"💰 LLM Cost ({model_name}): {prompt_tokens} input + {completion_tokens} output = ${total_cost:.6f}")
            return total_cost, f"Calculated using {model_name} pricing"
        
        else:
            # Use fallback pricing
            fallback = self.fallback_pricing['llm']
            input_cost = (prompt_tokens * fallback['input_cost_per_1m']) / 1_000_000
            output_cost = (completion_tokens * fallback['output_cost_per_1m']) / 1_000_000
            total_cost = input_cost + output_cost
            
            logger.warning(f"💰 LLM Cost (FALLBACK for '{model_name}'): ${total_cost:.6f}")
            return total_cost, f"Fallback pricing used for unknown model: {model_name}"

    def calculate_tts_cost(self, model_name: str, character_count: int) -> Tuple[float, str]:
        """Calculate TTS cost based on actual model and character count"""
        
        model_info = self.get_model_info(model_name)
        
        if model_info and model_info['type'] == 'tts':
            cost = (character_count * model_info['cost_per_1m_chars']) / 1_000_000
            
            logger.info(f"💰 TTS Cost ({model_name}): {character_count} chars = ${cost:.6f}")
            return cost, f"Calculated using {model_name} pricing"
        
        else:
            # Use fallback pricing
            fallback = self.fallback_pricing['tts']
            cost = (character_count * fallback['cost_per_1m_chars']) / 1_000_000
            
            logger.warning(f"💰 TTS Cost (FALLBACK for '{model_name}'): ${cost:.6f}")
            return cost, f"Fallback pricing used for unknown model: {model_name}"

    def calculate_stt_cost(self, model_name: str, duration_seconds: float) -> Tuple[float, str]:
        """Calculate STT cost based on actual model and audio duration"""
        
        model_info = self.get_model_info(model_name)
        duration_hours = duration_seconds / 3600
        
        if model_info and model_info['type'] == 'stt':
            cost = duration_hours * model_info['cost_per_hour']
            
            logger.info(f"💰 STT Cost ({model_name}): {duration_seconds:.2f}s = ${cost:.6f}")
            return cost, f"Calculated using {model_name} pricing"
        
        else:
            # Use fallback pricing
            fallback = self.fallback_pricing['stt']
            cost = duration_hours * fallback['cost_per_hour']
            
            logger.warning(f"💰 STT Cost (FALLBACK for '{model_name}'): ${cost:.6f}")
            return cost, f"Fallback pricing used for unknown model: {model_name}"

    def add_custom_model(self, model_name: str, model_config: Dict):
        """Add custom model pricing"""
        self.pricing_database[model_name] = model_config
        logger.info(f"💰 Added custom model pricing: {model_name}")

    def update_model_pricing(self, model_name: str, new_pricing: Dict):
        """Update existing model pricing"""
        if model_name in self.pricing_database:
            self.pricing_database[model_name].update(new_pricing)
            logger.info(f"💰 Updated pricing for {model_name}")
        else:
            logger.warning(f"💰 Model {model_name} not found for pricing update")

    def get_all_supported_models(self) -> Dict[str, Dict]:
        """Get all supported models and their pricing"""
        return self.pricing_database.copy()

    def debug_pricing_info(self, model_name: str):
        """Debug helper to see what pricing info is available"""
        print(f"\n🔍 PRICING DEBUG for '{model_name}':")
        
        model_info = self.get_model_info(model_name)
        if model_info:
            print(f"✅ Found pricing info:")
            for key, value in model_info.items():
                print(f"   {key}: {value}")
        else:
            print(f"❌ No pricing info found")
            print(f"🔄 Available models containing '{model_name.lower()}':")
            
            matches = [m for m in self.pricing_database.keys() if model_name.lower() in m.lower() or m.lower() in model_name.lower()]
            if matches:
                for match in matches:
                    print(f"   - {match}")
            else:
                print("   (No partial matches found)")


# Global instance
_pricing_calculator = ModelPricingCalculator()

def get_pricing_calculator() -> ModelPricingCalculator:
    """Get the global pricing calculator instance"""
    return _pricing_calculator

def calculate_dynamic_cost(span: Dict[str, Any]) -> Tuple[float, str]:
    """Calculate cost for a span using dynamic pricing"""
    calculator = get_pricing_calculator()
    metadata = span.get('metadata', {})
    operation = span.get('operation', '')
    
    if operation == 'llm':
        model_name = metadata.get('model_name') or metadata.get('model') or 'unknown'
        prompt_tokens = metadata.get('prompt_tokens', 0)
        completion_tokens = metadata.get('completion_tokens', 0)
        
        return calculator.calculate_llm_cost(model_name, prompt_tokens, completion_tokens)
        
    elif operation == 'tts':
        model_name = metadata.get('model_name') or metadata.get('model') or metadata.get('voice_id', 'unknown')
        character_count = metadata.get('characters_count', 0)
        
        return calculator.calculate_tts_cost(model_name, character_count)
        
    elif operation == 'stt':
        model_name = metadata.get('model_name') or metadata.get('model') or 'unknown'
        duration = metadata.get('audio_duration', 0)
        
        return calculator.calculate_stt_cost(model_name, duration)
    
    return 0.0, "No cost calculation available for this operation"