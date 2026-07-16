export interface FlowMatchSchedule {
  imageSequenceLength: number;
  steps: number;
  mu: number;
  sigmas: Float32Array;
  timesteps: Float32Array;
}

export function bonsaiImageSequenceLength(width: number, height: number): number {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || width % 32 || height % 32) {
    throw new Error("Bonsai image dimensions must be positive multiples of 32");
  }
  return (width / 16) * (height / 16);
}

export function empiricalMu(imageSequenceLength: number, steps: number): number {
  if (imageSequenceLength <= 0 || !Number.isInteger(steps) || steps <= 0) throw new Error("Invalid scheduler dimensions");
  const a1 = 8.73809524e-5;
  const b1 = 1.89833333;
  const a2 = 0.00016927;
  const b2 = 0.45666666;
  if (imageSequenceLength > 4300) return a2 * imageSequenceLength + b2;
  const muAt200Steps = a2 * imageSequenceLength + b2;
  const muAt10Steps = a1 * imageSequenceLength + b1;
  const slope = (muAt200Steps - muAt10Steps) / 190;
  return slope * steps + (muAt200Steps - 200 * slope);
}

function dynamicTimeShift(mu: number, sigma: number): number {
  if (sigma <= 0) return 0;
  if (sigma >= 1) return 1;
  const exponential = Math.exp(mu);
  return exponential / (exponential + (1 / sigma - 1));
}

export function createFlowMatchSchedule(width: number, height: number, steps = 4): FlowMatchSchedule {
  const imageSequenceLength = bonsaiImageSequenceLength(width, height);
  const mu = empiricalMu(imageSequenceLength, steps);
  const sigmas = new Float32Array(steps + 1);
  const timesteps = new Float32Array(steps);
  for (let index = 0; index < steps; index += 1) {
    const baseSigma = 1 - index / steps;
    const shifted = dynamicTimeShift(mu, baseSigma);
    sigmas[index] = shifted;
    timesteps[index] = shifted * 1000;
  }
  sigmas[steps] = 0;
  return { imageSequenceLength, steps, mu, sigmas, timesteps };
}

export function flowMatchEulerStep(
  sample: Float32Array,
  modelOutput: Float32Array,
  sigma: number,
  nextSigma: number,
  target: Float32Array = new Float32Array(sample.length),
): Float32Array {
  if (sample.length !== modelOutput.length || target.length !== sample.length) throw new Error("Euler tensor length mismatch");
  const delta = nextSigma - sigma;
  for (let index = 0; index < sample.length; index += 1) target[index] = sample[index] + delta * modelOutput[index];
  return target;
}
