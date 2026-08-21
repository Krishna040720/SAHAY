/**
 * SAHAY Client-Side Evidence & Photo Quality Assessor
 * ----------------------------------------------------
 * Analyzes pixel luminance, edge variance, face bounding box ratios, and multi-face
 * detection directly from the image canvas in the browser.
 */

/**
 * Computes image quality metrics from a canvas / image.
 *
 * @param {HTMLCanvasElement|HTMLImageElement} imgSource
 * @param {Object} detection - faceapi detection object
 * @param {number} totalFaces - count of faces in image
 * @returns {Object} Photo quality metrics
 */
export function evaluateCanvasQuality(imgSource, detection = null, totalFaces = 1) {
  try {
    let canvas = imgSource;
    if (imgSource instanceof HTMLImageElement || imgSource.tagName === 'IMG' || imgSource.tagName === 'VIDEO') {
      canvas = document.createElement('canvas');
      canvas.width = imgSource.naturalWidth || imgSource.videoWidth || imgSource.width || 640;
      canvas.height = imgSource.naturalHeight || imgSource.videoHeight || imgSource.height || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgSource, 0, 0, canvas.width, canvas.height);
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      return fallbackQuality(detection, totalFaces);
    }

    const imgW = canvas.width;
    const imgH = canvas.height;
    const imgData = ctx.getImageData(0, 0, imgW, imgH);
    const pixels = imgData.data;

    let totalLuma = 0;
    let laplacianVar = 0;
    let prevLuma = 0;
    const step = 4; // Sample every 4th pixel for performance
    let sampleCount = 0;

    for (let i = 0; i < pixels.length; i += step * 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      // Standard ITU-R BT.601 luma formula
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      totalLuma += luma;

      if (sampleCount > 0) {
        const diff = luma - prevLuma;
        laplacianVar += diff * diff;
      }
      prevLuma = luma;
      sampleCount++;
    }

    const avgBrightness = sampleCount > 0 ? totalLuma / sampleCount : 120;
    const variance = sampleCount > 1 ? laplacianVar / sampleCount : 100;
    // Map variance to 0-100 sharpness score
    const sharpnessScore = Math.max(10, Math.min(100, Math.round(Math.sqrt(variance) * 3.5)));

    let box = null;
    let occlusionScore = 0;
    if (detection && detection.box) {
      box = {
        x: detection.box.x,
        y: detection.box.y,
        width: detection.box.width,
        height: detection.box.height,
        imageWidth: imgW,
        imageHeight: imgH
      };

      // Check detection score as partial proxy for occlusion / low landmark confidence
      if (detection.score && detection.score < 0.6) {
        occlusionScore = 30;
      }
    }

    return {
      hasPhoto: true,
      faceDetected: Boolean(detection),
      faceCount: totalFaces,
      brightness: Math.round(avgBrightness),
      sharpness: sharpnessScore,
      box,
      occlusionScore
    };
  } catch (err) {
    console.warn('[EvidenceQuality] Canvas inspection fallback:', err);
    return fallbackQuality(detection, totalFaces);
  }
}

function fallbackQuality(detection, totalFaces) {
  return {
    hasPhoto: true,
    faceDetected: Boolean(detection),
    faceCount: totalFaces,
    brightness: 120,
    sharpness: 75,
    box: detection?.box || null,
    occlusionScore: 0
  };
}
