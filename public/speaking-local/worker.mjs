let recognizer;
// Two sizes of the same English-only model. "base" hears children's speech more accurately;
// "tiny" is the fallback for phones that cannot hold or run the larger one in reasonable time.
const MODELS = {
  base: { legacy: ['Xenova/whisper-base.en', '95bf40a508535962c6483ead40270b2e32267508'], current: ['onnx-community/whisper-base.en', '51eefc0af78b103839eda9e7e4f4186acc6517fe'] },
  tiny: { legacy: ['Xenova/whisper-tiny.en', '79fb389fc764e7c395bd330e9531d9d32ada7049'], current: ['onnx-community/whisper-tiny.en', '2575352d61be1bf7225cf8f8b268a4678025fc58'] },
};
let stage = 'starting', lastResource = '';
function diagnosticText(value) {
  return String(value || '').replace(/https?:\/\/[^\s"'<>]+/gi, '[resource URL]')
    .replace(/[\u0000-\u001f]/g, ' ').slice(0, 600);
}
// Probe the actual WebAssembly capability, rather than guessing from the phone name.
function supportsSimd() {
  try {
    return WebAssembly.validate(new Uint8Array([
      0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,
      10,10,1,8,0,65,0,253,15,253,98,11,
    ]));
  } catch { return false; }
}
let compatibility = !supportsSimd();
let accelerated = false;
self.onmessage = async ({ data }) => {
  const { id, type, audio } = data;
  try {
    if (type === 'load') {
      const simdSupported = supportsSimd();
      compatibility = data.forceCompatibility === true || !simdSupported;
      accelerated = compatibility && data.preferSimd === true && simdSupported;
      // The larger model is only worth running with SIMD; without it a phone would take far too long.
      const model = data.model === 'base' && simdSupported && (accelerated || !compatibility) ? 'base' : 'tiny';
      const [repository, revision] = MODELS[model][compatibility ? 'legacy' : 'current'];
      stage = 'import-engine'; lastResource = '';
      self.postMessage({ id, type: 'mode', compatibility, accelerated, simdSupported, model });
      const { pipeline, env } = compatibility
        ? await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js')
        : await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js');
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      env.backends.onnx.wasm.numThreads = 1;
      if (compatibility) {
        // ORT 1.14 still ships a scalar binary; newer ORT requires SIMD.
        env.backends.onnx.wasm.simd = accelerated;
        env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/';
      }
      stage = 'initialize-model';
      self.postMessage({ id, type: 'stage', stage });
      recognizer ??= pipeline('automatic-speech-recognition', repository, {
        revision,
        ...(compatibility ? { quantized: true } : { device: 'wasm', dtype: 'q8' }),
        progress_callback: progress => {
          if (progress.file) lastResource = `${diagnosticText(progress.file)} (${diagnosticText(progress.status)})`;
          self.postMessage({ id, type: 'progress', progress });
        },
      });
      const engine = await recognizer;
      // Warm-up run on a second of silence: the first real recording no longer pays for engine
      // start-up, and its time tells the page whether this device is fast enough for this model.
      stage = 'warm-up';
      const warmStarted = performance.now();
      try { await engine(new Float32Array(16000), { max_new_tokens: 4, do_sample: false }); } catch { /* Timing only. */ }
      const warmupMs = Math.round(performance.now() - warmStarted);
      let cached = false;
      try {
        const cache = await caches.open('transformers-cache');
        const urls = (await cache.keys()).map(request => request.url);
        cached = ['encoder_model_quantized.onnx', 'decoder_model_merged_quantized.onnx', 'tokenizer.json']
          .every(file => urls.some(url => url.includes(revision) && url.endsWith(file)));
      } catch { /* Cache persistence is best effort on mobile/private browsers. */ }
      self.postMessage({ id, type: 'ready', cached, model, warmupMs });
    } else if (type === 'transcribe') {
      stage = 'transcribe';
      if (!recognizer) throw new Error('not ready');
      // Never pass the expected answer as a prompt: it would bias the score.
      const started = performance.now();
      const result = await (await recognizer)(audio, { max_new_tokens: 80, do_sample: false });
      self.postMessage({ id, type: 'result', text: result.text, inferenceMs: Math.round(performance.now() - started) });
    }
  } catch (cause) {
    recognizer = null;
    // Report a bounded diagnostic code, not raw runtime logs or audio content.
    const message = String(cause?.message || cause);
    const code = /memory|allocat/i.test(message) ? 'MEMORY'
      : /fetch|network|download|load file|404/i.test(message) ? 'DOWNLOAD'
      : /wasm|WebAssembly|backend|CompileError/i.test(message) ? 'ENGINE' : 'MODEL';
    self.postMessage({ id, type: 'error', code, compatibility, accelerated, diagnostic: {
      stage, lastResource, name: diagnosticText(cause?.name || 'Error'), message: diagnosticText(message),
    } });
  }
};
