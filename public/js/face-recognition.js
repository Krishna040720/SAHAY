/**
 * SAHAY Client-Side Face Recognition Service (face-api.js)
 * --------------------------------------------------------
 * Performs on-device face detection, landmark localization, and 128-D descriptor
 * vector extraction directly in the browser using WebGL / TensorFlow.js.
 *
 * Guaranteed non-blocking: If face-api is unavailable or no face is present,
 * returns clean fallback results allowing seamless submission.
 */

let modelsLoaded = false;
let modelLoadingPromise = null;

// Primary local endpoints with remote CDN fallbacks for neural model weights
const MODEL_URLS = [
  '/models',
  'https://cdn.jsdelivr.net/gh/cgarciagl/face-api.js@master/weights/',
  'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/'
];

/**
 * Initializes and loads face-api.js neural network models.
 */
export async function loadFaceApiModels() {
  if (modelsLoaded) return true;
  if (modelLoadingPromise) return modelLoadingPromise;

  modelLoadingPromise = (async () => {
    if (typeof faceapi === 'undefined') {
      console.warn('[FaceAPI] face-api.js global script not loaded yet');
      return false;
    }

    for (const url of MODEL_URLS) {
      try {
        console.log(`[FaceAPI] Loading biometric models from: ${url}`);
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(url),
          faceapi.nets.faceLandmark68Net.loadFromUri(url),
          faceapi.nets.faceRecognitionNet.loadFromUri(url)
        ]);
        modelsLoaded = true;
        console.log('[FaceAPI] ✓ All facial recognition models loaded successfully.');
        return true;
      } catch (err) {
        console.warn(`[FaceAPI] Failed loading models from ${url}, trying next endpoint...`, err.message);
      }
    }

    console.warn('[FaceAPI] Could not load model weights. Operating in fallback mode.');
    return false;
  })();

  return modelLoadingPromise;
}

// Background preload models on page initialization
if (typeof window !== 'undefined') {
  setTimeout(() => {
    loadFaceApiModels().catch((e) => console.warn('[FaceAPI Preload Error]', e));
  }, 300);
}

import { evaluateCanvasQuality } from './evidence-quality.js';

/**
 * Extracts a 128-dimensional numerical face descriptor embedding from an image,
 * along with deep photo quality and facial usability metrics.
 *
 * @param {HTMLImageElement|HTMLCanvasElement|HTMLVideoElement|string} input - Image element or Base64 data URL
 * @returns {Promise<{ detected: boolean, descriptor: number[]|null, confidence: number, photoQuality?: Object, reason?: string, error?: string }>}
 */
export async function extractFaceDescriptor(input) {
  try {
    if (typeof faceapi === 'undefined') {
      return { detected: false, descriptor: null, confidence: 0, reason: 'LIBRARY_UNAVAILABLE' };
    }

    const ready = await loadFaceApiModels();
    if (!ready) {
      return { detected: false, descriptor: null, confidence: 0, reason: 'MODELS_NOT_LOADED' };
    }

    let imageEl = input;

    // If input is a Base64 data URL string, convert to HTMLImageElement
    if (typeof input === 'string') {
      imageEl = await new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image for face detection'));
        img.src = input;
      });
    }

    // Run face detection with TinyFaceDetector, landmark localization, and 128-D descriptor generation
    const detectorOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 });

    // Check multi-face count if method available
    let totalFaces = 1;
    try {
      if (faceapi.detectAllFaces) {
        const all = await faceapi.detectAllFaces(imageEl, detectorOptions);
        if (all && all.length > 0) totalFaces = all.length;
      }
    } catch (_) {}

    const detection = await faceapi
      .detectSingleFace(imageEl, detectorOptions)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      console.log('[FaceAPI] No human face clearly detected in photo.');
      const qualityMetrics = evaluateCanvasQuality(imageEl, null, 0);
      return {
        detected: false,
        descriptor: null,
        confidence: 0,
        reason: 'NO_FACE_DETECTED',
        photoQuality: qualityMetrics
      };
    }

    const descriptorArray = Array.from(detection.descriptor).map((v) => Math.round(v * 10000) / 10000);
    const score = Math.round(detection.detection.score * 100);
    const qualityMetrics = evaluateCanvasQuality(imageEl, detection.detection, totalFaces);

    console.log(`[FaceAPI] ✓ Face detected with ${score}% confidence. 128-D embedding extracted.`);

    return {
      detected: true,
      descriptor: descriptorArray,
      confidence: score,
      box: detection.detection.box,
      photoQuality: qualityMetrics
    };
  } catch (err) {
    console.error('[FaceAPI Extraction Error]', err);
    return {
      detected: false,
      descriptor: null,
      confidence: 0,
      error: err.message
    };
  }
}

/**
 * Calculates Euclidean distance between two 128-D descriptors.
 */
export function calculateEuclideanDistance(vec1, vec2) {
  if (!vec1 || !vec2 || vec1.length !== vec2.length || vec1.length === 0) return null;
  let sum = 0;
  for (let i = 0; i < vec1.length; i++) {
    const d = Number(vec1[i]) - Number(vec2[i]);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * Calculates normalized face similarity (0% to 100%).
 */
export function calculateFaceSimilarityScore(vec1, vec2) {
  const dist = calculateEuclideanDistance(vec1, vec2);
  if (dist === null) return null;
  const sim = Math.max(0, Math.min(1, 1 - (dist / 0.85)));
  return Math.round(sim * 100);
}
