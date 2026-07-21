/**
 * Profile dialog validation hook.
 */

import {
  intRequired,
  intOptional,
  numRequired,
  floatOptional,
  intGeZeroOptional,
  floatGeZeroOptional,
  stringRequired,
} from "./new-profile-validators";
import type { ProfileFormState } from "./new-profile-form";

function useProfileValidation(f: ProfileFormState) {
  const ctxSizeValidator = intRequired(512, 1048576);
  const threadsValidator = intRequired(1, 128);
  const gpuLayersValidator = intOptional(-1, 128);
  const portValidator = intRequired(1024, 65535);
  const parallelValidator = intOptional(-1, 128);
  const nPredictValidator = intOptional(-1, 100000);
  const timeoutValidator = numRequired(1, 86400);
  const threadsBatchValidator = intOptional(-1, 128);
  const batchSizeValidator = intRequired(1, 1048576);
  const ubatchSizeValidator = intRequired(1, 1048576);
  const mainGpuValidator = intGeZeroOptional();
  const temperatureValidator = floatOptional(0, 2);
  const topKValidator = intOptional(0, 1000);
  const topPValidator = floatOptional(0, 1);
  const minPValidator = floatOptional(0, 1);
  const repeatPenaltyValidator = floatOptional(1, 2);
  const repeatLastNValidator = intOptional(-1, 1048576);
  const presencePenaltyValidator = floatOptional(0, 2);
  const frequencyPenaltyValidator = floatOptional(0, 2);
  const reasoningBudgetValidator = intOptional(-1, 100000);
  const ropeScaleValidator = floatGeZeroOptional();
  const ropeFreqBaseValidator = floatGeZeroOptional();
  const ropeFreqScaleValidator = floatGeZeroOptional();
  const logLevelValidator = intOptional(0, 5);

  const v = {
    name: () => stringRequired(100)(f.name),
    ctxSize: () => ctxSizeValidator(f.ctxSize),
    threads: () => threadsValidator(f.threads),
    gpuLayers: () => gpuLayersValidator(f.gpuLayers),
    port: () => portValidator(f.port),
    host: () => stringRequired()(f.host),
    parallel: () => parallelValidator(f.parallel),
    nPredict: () => nPredictValidator(f.nPredict),
    timeout: () => timeoutValidator(f.timeout),
    threadsBatch: () => threadsBatchValidator(f.threadsBatch),
    batchSize: () => batchSizeValidator(f.batchSize),
    ubatchSize: () => ubatchSizeValidator(f.ubatchSize),
    mainGpu: () => mainGpuValidator(f.mainGpu),
    temperature: () => temperatureValidator(f.temperature),
    topK: () => topKValidator(f.topK),
    topP: () => topPValidator(f.topP),
    minP: () => minPValidator(f.minP),
    repeatPenalty: () => repeatPenaltyValidator(f.repeatPenalty),
    repeatLastN: () => repeatLastNValidator(f.repeatLastN),
    presencePenalty: () => presencePenaltyValidator(f.presencePenalty),
    frequencyPenalty: () => frequencyPenaltyValidator(f.frequencyPenalty),
    seed: () => {
      const n = Number(f.seed);
      if (f.seed !== "" && (isNaN(n) || !Number.isInteger(n) || n < -1)) return "-1 = random";
      return "";
    },
    reasoningBudget: () => reasoningBudgetValidator(f.reasoningBudget),
    ropeScale: () => ropeScaleValidator(f.ropeScale),
    ropeFreqBase: () => ropeFreqBaseValidator(f.ropeFreqBase),
    ropeFreqScale: () => ropeFreqScaleValidator(f.ropeFreqScale),
    logLevel: () => logLevelValidator(f.logLevel),
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    for (const [k, fn] of Object.entries(v)) {
      const e = fn();
      if (e) errs[k] = e;
    }
    return Object.keys(errs).length === 0;
  };

  return { validate, errors: v };
}

export { useProfileValidation };
