let recognizer;
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
      stage = 'import-engine'; lastResource = '';
      self.postMessage({ id, type: 'mode', compatibility, accelerated, simdSupported });
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
      recognizer ??= pipeline('automatic-speech-recognition', compatibility ? 'Xenova/whisper-tiny.en' : 'onnx-community/whisper-tiny.en', {
        revision: compatibility ? '79fb389fc764e7c395bd330e9531d9d32ada7049' : '2575352d61be1bf7225cf8f8b268a4678025fc58',
        ...(compatibility ? { quantized: true } : { device: 'wasm', dtype: 'q8' }),
        progress_callback: progress => {
          if (progress.file) lastResource = `${diagnosticText(progress.file)} (${diagnosticText(progress.status)})`;
          self.postMessage({ id, type: 'progress', progress });
        },
      });
      await recognizer;
      self.postMessage({ id, type: 'ready' });
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
