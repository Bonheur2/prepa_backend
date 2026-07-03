// @xenova/transformers imports `sharp` unconditionally, and throws at
// *import time* if it's falsy (`else { throw new Error('Unable to load
// image processing library.') }` in its utils/image.js) -- so the stub
// must be truthy, not just absent. We only use the text embedding
// pipeline, never the image ones, so this function is never actually
// called; it exists purely to satisfy that truthiness check without
// needing sharp's real native binary (whose installer needs a
// github.com download this environment can't reach).
module.exports = function sharpStub() {
  throw new Error('sharp is stubbed out in this deployment -- image processing is not supported.');
};
