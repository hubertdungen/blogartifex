/**
 * Shrinks images embedded as data: URIs to web size.
 *
 * Imported and pasted Word images arrive at full camera resolution and are
 * embedded in the post HTML (the Blogger API has no image upload), so one
 * photo can add megabytes of text to the post and Blogger then refuses it
 * ("Request contains an invalid argument"). Each large image is redrawn at
 * most MAX_WIDTH wide; opaque ones become JPEG. A result is only used when
 * it is actually smaller.
 */

const MAX_WIDTH = 1600;
const JPEG_QUALITY = 0.82;
const MIN_BYTES = 120 * 1024; // leave icons and small images alone

const loadImage = src => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

const hasTransparency = (context, width, height) => {
  // Sample a grid instead of every pixel: enough to spot a transparent
  // background or logo edges without stalling on large images.
  const step = Math.max(1, Math.floor(Math.min(width, height) / 64));
  const { data } = context.getImageData(0, 0, width, height);
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (data[(y * width + x) * 4 + 3] < 250) return true;
    }
  }
  return false;
};

/**
 * @param {string} src - a data: URI
 * @returns {Promise<string>} a smaller data: URI, or src unchanged
 */
export const shrinkDataUri = async (src) => {
  if (!src || !src.startsWith('data:image/') || src.startsWith('data:image/svg') || src.startsWith('data:image/gif')) {
    return src;
  }
  // base64 length × 3/4 ≈ bytes
  if (src.length * 0.75 < MIN_BYTES) return src;

  try {
    const image = await loadImage(src);
    const scale = Math.min(1, MAX_WIDTH / image.naturalWidth);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, width, height);

    const keepAlpha = !src.startsWith('data:image/jpeg') && hasTransparency(context, width, height);
    const result = keepAlpha
      ? canvas.toDataURL('image/png')
      : canvas.toDataURL('image/jpeg', JPEG_QUALITY);

    return result.length < src.length ? result : src;
  } catch {
    return src; // undecodable image: keep what the user had
  }
};

/**
 * Shrinks every large embedded image in an HTML fragment.
 * @param {string} html
 * @returns {Promise<{ html: string, saved: number }>} saved = bytes removed
 */
export const shrinkEmbeddedImages = async (html) => {
  if (!html || !html.includes('data:image/')) return { html, saved: 0 };

  const root = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;
  let saved = 0;

  for (const image of root.querySelectorAll('img[src^="data:image/"]')) {
    const src = image.getAttribute('src');
    const smaller = await shrinkDataUri(src);
    if (smaller !== src) {
      saved += Math.round((src.length - smaller.length) * 0.75);
      image.setAttribute('src', smaller);
    }
  }

  return saved ? { html: root.innerHTML, saved } : { html, saved: 0 };
};

/** Approximate size in bytes of an HTML string as sent to Blogger. */
export const byteSize = (text) => new Blob([text || '']).size;
