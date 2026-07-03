import type { FeatureExtractionPipeline } from '@xenova/transformers';
import dynamicImport from './dynamicImport';

// @xenova/transformers is pure ESM with no CommonJS export -- see
// Utils/dynamicImport.ts for why a plain `import()` wouldn't work here.
let pipelinePromise: Promise<FeatureExtractionPipeline> | undefined;

function getPipeline() {
  if (!pipelinePromise) {
    pipelinePromise = dynamicImport('@xenova/transformers').then(({ pipeline }) =>
      pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { quantized: true })
    );
  }
  return pipelinePromise;
}

export async function embed(text: string): Promise<number[]> {
  const extractor = await getPipeline();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array);
}
