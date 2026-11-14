import { z } from "zod";
import { createWorkflow } from "../core";
import { parseSymptomStep } from "../steps/parseSymptomStep";
import { correlateTelemetryStep } from "../steps/correlateTelemetryStep";
import { generateInterimActionsStep } from "../steps/generateInterimActionsStep";
import { epistemicGuardrailStep } from "../steps/epistemicGuardrailStep";
import { buildSurgeonPacketStep } from "../steps/buildSurgeonPacketStep";

export const clinicalTriageWorkflow = createWorkflow({
  id: "clinical-triage-workflow",
  inputSchema: z.object({
    symptomText: z.string(),
    compartmentOverride: z.string().optional(),
    currentSnapshot: z.object({
      co2Ppm: z.number(),
      tempC: z.number(),
      humidityPct: z.number(),
      radiationRateMGy: z.number(),
      pressureMmHg: z.number(),
    }),
    astronautId: z.string().optional(),
  }),
})
  .step(parseSymptomStep)
  .then(correlateTelemetryStep)
  .then(generateInterimActionsStep)
  .then(epistemicGuardrailStep)
  .then(buildSurgeonPacketStep)
  .commit();
