import fc from 'fast-check';

/** Runs per property. PR gate: 100 (default). Nightly: FUZZ_RUNS=2000. */
const NUM_RUNS = Number(process.env.FUZZ_RUNS ?? 100);

/**
 * Fixed default seed => CI is deterministic and a red build can be reproduced exactly.
 * Nightly jobs pass a fresh FUZZ_SEED to explore new inputs; the failure message prints the seed to replay.
 */
const SEED = Number(process.env.FUZZ_SEED ?? 20260101);

export const PARAMS: fc.Parameters<unknown> = { numRuns: NUM_RUNS, seed: SEED, endOnFailure: false };
