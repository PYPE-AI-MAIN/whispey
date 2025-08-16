// vapi-data-transformer-complete-fixed.ts
interface VapiWebhookData {
  message?: {
    type: string;
    call: any;
    assistant: any;
    artifact: any;
    startedAt: string;
    endedAt: string;
    endedReason: string;
    cost: number;
    costBreakdown: any;
    durationMs: number;
    durationSeconds: number;
    summary: string;
    transcript: string;
    messages: any[];
    performanceMetrics?: {
      turnLatencies: Array<{
        modelLatency: number;
        voiceLatency: number;
        transcriberLatency: number;
        endpointingLatency: number;
        turnLatency: number;
      }>;
      modelLatencyAverage: number;
      voiceLatencyAverage: number;
      transcriberLatencyAverage: number;
      endpointingLatencyAverage: number;
      turnLatencyAverage: number;
    };
  };
}

interface DBCallData {
  call_id: string;
  agent_id: string;
  recording_url: string;
  customer_number: string;
  transcript_with_metrics: Array<{
    turn_id: number;
    user_transcript: string;
    agent_response: string;
    timestamp: number;
    stt_metrics: {
      duration: number;
      confidence: number;
    };
    llm_metrics: {
      ttft: number;
      total_time: number;
      tokens: number;
    };
    tts_metrics: {
      ttfb: number;
      duration: number;
    };
    eou_metrics: {
      end_of_utterance_delay: number;
    };
  }>;
  call_ended_reason: string;
  environment: string;
  metadata: {
    total_cost: number;
    total_duration_seconds: number;
    call_started_at: string;
    call_ended_at: string;
    summary: string;
    raw_transcript: string;
    customer_number: string; // Add phone number field
    // Allow additional properties
    [key: string]: any;
  };
}

class VapiDataTransformer {
  private readonly environment: string;

  constructor(environment: 'dev' | 'staging' | 'prod' = 'dev') {
    this.environment = environment;
  }

  private extractPhoneNumber(messageData: any): string {
    // For dashboard calls (webCall), use call ID as identifier
    if (messageData.call?.type === 'webCall') {
      console.log('📱 Dashboard call - using call ID as identifier');
      return `web-call-${messageData.call?.id}` || 'unknown-webcall';
    }
    
    // For real phone calls, look for actual phone number
    console.log('📞 Phone call detected - looking for phone number...');
    
    // Try different locations for phone number in real phone calls
    if (messageData.call?.phoneNumber) {
      return messageData.call.phoneNumber;
    } else if (messageData.call?.customer?.number) {
      return messageData.call.customer.number;
    } else if (messageData.call?.phoneNumberId) {
      return messageData.call.phoneNumberId;
    }
    
    // Fallback to empty string for real phone calls if no number found
    return '';
  }

  public transformVapiToDbFormat(webhookData: VapiWebhookData): DBCallData | null {
    try {
      if (!this.validateWebhookData(webhookData)) {
        console.error('❌ Invalid webhook data structure');
        return null;
      }

      const messageData = webhookData.message!;
      
      // Get performance metrics
      const performanceMetrics = messageData.performanceMetrics || messageData.artifact?.performanceMetrics;
      const turnLatencies = performanceMetrics?.turnLatencies || [];
      
      if (performanceMetrics?.turnLatencies) {
        console.log('✅ Found metrics - Count:', turnLatencies.length);
      } else {
        console.log('❌ No metrics found');
      }
      
      // Extract basic call information
      const callId = messageData.call?.id || 'unknown';
      const agentId = messageData.assistant?.id || 'unknown';
      const endedReason = this.normalizeCallEndedReason(messageData.endedReason || 'unknown');
      
      // EXTRACT PHONE NUMBER: Check multiple possible locations
      const phoneNumber = this.extractPhoneNumber(messageData);
      console.log('📞 PHONE NUMBER EXTRACTION:', phoneNumber);

      // FIXED: Extract and validate timestamps
      const { startTime, endTime, durationSeconds } = this.extractTimingData(messageData);

      // Transform messages into conversation turns
      const conversationTurns = this.extractConversationTurns(messageData.messages || [], startTime);
      
      // Map performance metrics to turns
      const turnsWithMetrics = this.mapMetricsToTurns(conversationTurns, turnLatencies);

      // Extract recording URL
      const recordingUrl = messageData.artifact?.recordingUrl || 
                          messageData.artifact?.stereoRecordingUrl ||
                          '';

      const dbData: DBCallData = {
        call_id: callId,
        agent_id: agentId,
        recording_url: recordingUrl,
        transcript_with_metrics: turnsWithMetrics,
        call_ended_reason: endedReason,
        environment: this.environment,
        customer_number: phoneNumber,
        metadata: {
          total_cost: messageData.cost || 0,
          total_duration_seconds: durationSeconds,
          call_started_at: startTime,
          call_ended_at: endTime,
          summary: messageData.summary || '',
          raw_transcript: messageData.transcript || '',
          customer_number: phoneNumber, // Add phone number to metadata
        },
      };

      console.log('📊 FINAL TIMING DATA:');
      console.log('call_started_at:', dbData.metadata.call_started_at);
      console.log('call_ended_at:', dbData.metadata.call_ended_at);
      console.log('total_duration_seconds:', dbData.metadata.total_duration_seconds);

      if (!this.validateDbData(dbData)) {
        console.error('❌ Transformed data failed validation');
        return null;
      }

      console.log(`✅ Successfully transformed call ${callId} with ${turnsWithMetrics.length} turns`);
      return dbData;

    } catch (error) {
      console.error('❌ Error transforming VAPI data:', error);
      return null;
    }
  }

  // FIXED: Extract timing data with proper validation
  private extractTimingData(messageData: any): { startTime: string, endTime: string, durationSeconds: number } {
    let startTime = '';
    let endTime = '';
    let durationSeconds = 0;

    // Try to get start time
    if (messageData.startedAt) {
      try {
        const startDate = new Date(messageData.startedAt);
        if (!isNaN(startDate.getTime())) {
          startTime = startDate.toISOString();
        }
      } catch (error) {
        console.warn('⚠️ Invalid startedAt timestamp:', messageData.startedAt);
      }
    }

    // Try to get end time
    if (messageData.endedAt) {
      try {
        const endDate = new Date(messageData.endedAt);
        if (!isNaN(endDate.getTime())) {
          endTime = endDate.toISOString();
        }
      } catch (error) {
        console.warn('⚠️ Invalid endedAt timestamp:', messageData.endedAt);
      }
    }

    // Calculate duration - try multiple sources
    if (messageData.durationSeconds && messageData.durationSeconds > 0) {
      durationSeconds = messageData.durationSeconds;
    } else if (messageData.durationMs && messageData.durationMs > 0) {
      durationSeconds = messageData.durationMs / 1000;
    } else if (startTime && endTime) {
      // Calculate from timestamps
      const start = new Date(startTime);
      const end = new Date(endTime);
      durationSeconds = (end.getTime() - start.getTime()) / 1000;
    }

    // Fallback: if we still don't have timestamps, use current time
    if (!startTime || !endTime) {
      const now = new Date();
      if (!endTime) {
        endTime = now.toISOString();
      }
      if (!startTime && durationSeconds > 0) {
        const startDate = new Date(now.getTime() - (durationSeconds * 1000));
        startTime = startDate.toISOString();
      }
    }

    console.log('🕐 TIMING EXTRACTION:');
    console.log('Raw startedAt:', messageData.startedAt, '→ Processed:', startTime);
    console.log('Raw endedAt:', messageData.endedAt, '→ Processed:', endTime);
    console.log('Raw durationSeconds:', messageData.durationSeconds, '→ Final:', durationSeconds);
    console.log('Raw durationMs:', messageData.durationMs);

    return { startTime, endTime, durationSeconds };
  }

  private normalizeCallEndedReason(reason: string): string {
    const reasonLower = reason.toLowerCase();
    
    if (reasonLower.includes('user') || reasonLower.includes('hangup') || 
        reasonLower.includes('assistant') || reasonLower.includes('ended')) {
      return 'completed';
    }
    if (reasonLower.includes('timeout') || reasonLower.includes('exceeded')) {
      return 'timeout';
    }
    if (reasonLower.includes('error') || reasonLower.includes('failed')) {
      return 'error';
    }
    
    return 'completed'; // Default
  }

  private validateWebhookData(data: VapiWebhookData): boolean {
    if (!data.message) {
      console.error('Missing message object');
      return false;
    }

    if (data.message.type !== 'end-of-call-report') {
      console.log(`Skipping non-end-of-call message: ${data.message.type}`);
      return false;
    }

    return true;
  }

  private extractConversationTurns(messages: any[], callStartTime: string): Array<{
    turnId: number;
    userMessage: any;
    botMessage: any;
    timestamp: number;
  }> {
    const conversationTurns: Array<{
      turnId: number;
      userMessage: any;
      botMessage: any;
      timestamp: number;
    }> = [];

    const conversationMessages = messages.filter(msg => 
      msg.role === 'user' || msg.role === 'bot' || msg.role === 'assistant'
    );

    // Get call start timestamp for relative calculation
    const callStartTimestamp = callStartTime ? new Date(callStartTime).getTime() / 1000 : Date.now() / 1000;

    let turnId = 1;
    let i = 0;

    while (i < conversationMessages.length) {
      const currentMsg = conversationMessages[i];
      
      // FIXED: Calculate proper timestamp
      let timestamp = callStartTimestamp;
      if (currentMsg.time) {
        // If time is in milliseconds since call start, convert to unix timestamp
        if (currentMsg.time < callStartTimestamp) {
          timestamp = callStartTimestamp + (currentMsg.time / 1000);
        } else {
          timestamp = Math.floor(currentMsg.time / 1000);
        }
      }

      if (currentMsg.role === 'user') {
        let botResponse = null;
        let j = i + 1;

        while (j < conversationMessages.length) {
          if (conversationMessages[j].role === 'bot' || conversationMessages[j].role === 'assistant') {
            botResponse = conversationMessages[j];
            break;
          }
          j++;
        }

        if (botResponse) {
          conversationTurns.push({
            turnId,
            userMessage: currentMsg,
            botMessage: botResponse,
            timestamp,
          });
          turnId++;
          i = j + 1;
        } else {
          conversationTurns.push({
            turnId,
            userMessage: currentMsg,
            botMessage: null,
            timestamp,
          });
          turnId++;
          i++;
        }
      } else if (currentMsg.role === 'bot' || currentMsg.role === 'assistant') {
        conversationTurns.push({
          turnId,
          userMessage: null,
          botMessage: currentMsg,
          timestamp,
        });
        turnId++;
        i++;
      } else {
        i++;
      }
    }

    return conversationTurns;
  }

  private mapMetricsToTurns(
    conversationTurns: Array<{
      turnId: number;
      userMessage: any;
      botMessage: any;
      timestamp: number;
    }>,
    turnLatencies: Array<{
      modelLatency: number;
      voiceLatency: number;
      transcriberLatency: number;
      endpointingLatency: number;
      turnLatency: number;
    }>
  ): Array<{
    turn_id: number;
    user_transcript: string;
    agent_response: string;
    timestamp: number;
    stt_metrics: {
      duration: number;
      confidence: number;
    };
    llm_metrics: {
      ttft: number;
      total_time: number;
      tokens: number;
    };
    tts_metrics: {
      ttfb: number;
      duration: number;
    };
    eou_metrics: {
      end_of_utterance_delay: number;
    };
  }> {
    console.log(`🔍 Mapping ${conversationTurns.length} turns with ${turnLatencies.length} metric entries`);
    
    return conversationTurns.map((turn, index) => {
      const userTranscript = turn.userMessage?.message || '';
      const agentResponse = turn.botMessage?.message || '';
      const estimatedTokens = Math.ceil(agentResponse.length / 4);

      let metrics = {
        modelLatency: 0,
        voiceLatency: 0,
        transcriberLatency: 0,
        endpointingLatency: 0,
        turnLatency: 0,
      };

      // Map metrics if available
      if (userTranscript.length > 0 && agentResponse.length > 0 && turnLatencies.length > 0) {
        const actualTurnIndex = conversationTurns
          .slice(0, index + 1)
          .filter(t => (t.userMessage?.message || '').length > 0 && (t.botMessage?.message || '').length > 0)
          .length - 1;

        if (actualTurnIndex >= 0 && actualTurnIndex < turnLatencies.length) {
          metrics = turnLatencies[actualTurnIndex];
        }
      }

      // FIXED: Convert all metrics from milliseconds to seconds
      return {
        turn_id: turn.turnId,
        user_transcript: userTranscript,
        agent_response: agentResponse,
        timestamp: Math.floor(turn.timestamp), // Ensure integer timestamp
        stt_metrics: {
          duration: Number(((metrics.transcriberLatency || 0) / 1000).toFixed(3)), // ms to seconds, 3 decimal places
          confidence: 0.95,
        },
        llm_metrics: {
          ttft: Number(((metrics.modelLatency || 0) / 1000).toFixed(3)), // ms to seconds
          total_time: Number(((metrics.modelLatency || 0) / 1000).toFixed(3)), // ms to seconds
          tokens: estimatedTokens,
        },
        tts_metrics: {
          ttfb: Number(((metrics.voiceLatency || 0) / 1000).toFixed(3)), // ms to seconds
          duration: Number(((metrics.voiceLatency || 0) / 1000).toFixed(3)), // ms to seconds
        },
        eou_metrics: {
          end_of_utterance_delay: Number(((metrics.endpointingLatency || 0) / 1000).toFixed(3)), // ms to seconds
        },
      };
    });
  }

  private validateDbData(data: DBCallData): boolean {
    if (!data.call_id || data.call_id === 'unknown') {
      console.error('Invalid call_id');
      return false;
    }

    if (!data.agent_id || data.agent_id === 'unknown') {
      console.error('Invalid agent_id');
      return false;
    }

    if (!Array.isArray(data.transcript_with_metrics)) {
      console.error('Invalid transcript_with_metrics format');
      return false;
    }

    return true;
  }

  public logTransformationDetails(webhookData: VapiWebhookData, transformedData: DBCallData | null): void {
    if (!transformedData) {
      console.log('❌ Transformation failed - no output data');
      return;
    }

    console.log('📊 TRANSFORMATION SUMMARY:');
    console.log(`Call ID: ${transformedData.call_id}`);
    console.log(`Agent ID: ${transformedData.agent_id}`);
    console.log(`Total Turns: ${transformedData.transcript_with_metrics.length}`);
    console.log(`Total Cost: $${transformedData.metadata.total_cost}`);
    console.log(`Duration: ${transformedData.metadata.total_duration_seconds}s`);
    console.log(`Call Ended Reason: ${transformedData.call_ended_reason}`);
    console.log(`Started At: ${transformedData.metadata.call_started_at}`);
    console.log(`Ended At: ${transformedData.metadata.call_ended_at}`);
    console.log(`Environment: ${transformedData.environment}`);
    
    // Log first few turns with proper metric display
    const turnsToLog = transformedData.transcript_with_metrics.slice(0, 2);
    turnsToLog.forEach(turn => {
      console.log(`Turn ${turn.turn_id}:`);
      console.log(`  User: "${turn.user_transcript.substring(0, 50)}${turn.user_transcript.length > 50 ? '...' : ''}"`);
      console.log(`  Agent: "${turn.agent_response.substring(0, 50)}${turn.agent_response.length > 50 ? '...' : ''}"`);
      console.log(`  Timestamp: ${new Date(turn.timestamp * 1000).toISOString()}`);
      console.log(`  Metrics: STT:${turn.stt_metrics.duration}s, LLM:${turn.llm_metrics.total_time}s, TTS:${turn.tts_metrics.duration}s`);
    });
    
    if (transformedData.transcript_with_metrics.length > 2) {
      console.log(`... and ${transformedData.transcript_with_metrics.length - 2} more turns`);
    }
  }
}

export { VapiDataTransformer, type VapiWebhookData, type DBCallData };