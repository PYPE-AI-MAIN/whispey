// src/components/CostTooltip.tsx
import * as Tooltip from "@radix-ui/react-tooltip";
import React from "react";
import { plivoRate } from "../../../utils/constants";
import { telecomCost } from "../../../utils/cost";
import { CallLog } from "../../../types/logs";

type Props = {
  call: CallLog;
};

export const CostTooltip: React.FC<Props> = ({ call}) => {
  const telecom = telecomCost(call.duration_seconds);
  const total = call.total_stt_cost! + call.total_llm_cost! + call.total_tts_cost! + telecom;

  return (
    <Tooltip.Provider delayDuration={400}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span
            tabIndex={0}
            className="font-mono cursor-help"
            aria-label={`Total ₹${total.toFixed(2)}. Hover for cost breakdown.`}
          >
            ₹{total.toFixed(2)}
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={4}
            className="rounded-md bg-gray-800 text-white text-xs px-2 py-1 z-50 shadow"
            style={{ whiteSpace: "pre-line" }}
          >
            {`LLM ₹${call.total_llm_cost?.toFixed(2)}
              TTS ₹${call.total_tts_cost?.toFixed(2)}
              STT ₹${call.total_stt_cost?.toFixed(2)}
              Plivo ₹${telecom.toFixed(2)} (${plivoRate.toFixed(2)}/min)`}

            <Tooltip.Arrow className="fill-gray-800" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};
