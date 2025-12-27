/**
 * Image Processing Utilities
 * Compression, WebP conversion, and optimization using Cloudflare Images
 */

import type { Env } from '../index';

// ============================================
// Types
// ============================================

interface ImageProcessingOptions {
  width?: number;
  height?: number;
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
  quality?: number; // 1-100
  format?: 'webp' | 'avif' | 'json' | 'jpeg' | 'png';
  blur?: number; // 1-250
  sharpen?: number; // 0-10
  brightness?: number; // 0-255
  contrast?: number; // 0-255
  gamma?: number; // 0-255
  rotate?: 0 | 90 | 180 | 270;
  background?: string; // hex color for padding
  dpr?: number; // device pixel ratio 1-3
}

interface ProcessedImage {
  url: string;
  width?: number;
  height?: number;
  format: string;
  size?: number;
}

interface UploadResult {
  success: boolean;
  id?: string;
  url?: string;
  variants?: string[];
  error?: string;
}

// ============================================
// Cloudflare Images Integration
// ============================================

/**
 * Upload image to Cloudflare Images
 */
export async function uploadToCloudflareImages(
  env: Env,
  imageData: ArrayBuffer | Blob | ReadableStream,
  metadata?: Record<string, string>
): Promise<UploadResult> {
  const accountId = (env as any).CF_ACCOUNT_ID;
  const apiToken = (env as any).CF_IMAGES_TOKEN;

  if (!accountId || !apiToken) {
    return {
      success: false,
      error: 'Cloudflare Images not configured (missing CF_ACCOUNT_ID or CF_IMAGES_TOKEN)',
    };
  }

  const formData = new FormData();
  
  if (imageData instanceof Blob) {
    formData.append('file', imageData);
  } else if (imageData instanceof ArrayBuffer) {
    formData.append('file', new Blob([imageData]));
  } else {
    // ReadableStream - convert to blob first
    const response = new Response(imageData);
    const blob = await response.blob();
    formData.append('file', blob);
  }

  if (metadata) {
    formData.append('metadata', JSON.stringify(metadata));
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
        body: formData,
      }
    );

    const result = await response.json() as any;

    if (!result.success) {
      return {
        success: false,
        error: result.errors?.[0]?.message || 'Upload failed',
      };
    }

    return {
      success: true,
      id: result.result.id,
      url: result.result.variants?.[0],
      variants: result.result.variants,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Delete image from Cloudflare Images
 */
export async function deleteFromCloudflareImages(
  env: Env,
  imageId: string
): Promise<{ success: boolean; error?: string }> {
  const accountId = (env as any).CF_ACCOUNT_ID;
  const apiToken = (env as any).CF_IMAGES_TOKEN;

  if (!accountId || !apiToken) {
    return { success: false, error: 'Cloudflare Images not configured' };
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${imageId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      }
    );

    const result = await response.json() as any;
    return { success: result.success };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================
// Image URL Transformation (Cloudflare Image Resizing)
// ============================================

/**
 * Generate optimized image URL using Cloudflare Image Resizing
 * Works with images served through Cloudflare
 */
export function getOptimizedImageUrl(
  originalUrl: string,
  options: ImageProcessingOptions
): string {
  const params: string[] = [];

  if (options.width) params.push(`width=${options.width}`);
  if (options.height) params.push(`height=${options.height}`);
  if (options.fit) params.push(`fit=${options.fit}`);
  if (options.quality) params.push(`quality=${options.quality}`);
  if (options.format) params.push(`format=${options.format}`);
  if (options.blur) params.push(`blur=${options.blur}`);
  if (options.sharpen) params.push(`sharpen=${options.sharpen}`);
  if (options.brightness) params.push(`brightness=${options.brightness}`);
  if (options.contrast) params.push(`contrast=${options.contrast}`);
  if (options.gamma) params.push(`gamma=${options.gamma}`);
  if (options.rotate) params.push(`rotate=${options.rotate}`);
  if (options.background) params.push(`background=${options.background}`);
  if (options.dpr) params.push(`dpr=${options.dpr}`);

  if (params.length === 0) {
    return originalUrl;
  }

  // Use Cloudflare Image Resizing URL format
  // /cdn-cgi/image/{options}/{image-url}
  const transformString = params.join(',');
  
  try {
    const url = new URL(originalUrl);
    return `${url.origin}/cdn-cgi/image/${transformString}${url.pathname}`;
  } catch {
    // If URL parsing fails, return original
    return originalUrl;
  }
}

/**
 * Generate responsive image srcset
 */
export function generateSrcSet(
  originalUrl: string,
  widths: number[] = [320, 640, 768, 1024, 1280, 1536],
  options: Omit<ImageProcessingOptions, 'width'> = {}
): string {
  return widths
    .map((width) => {
      const url = getOptimizedImageUrl(originalUrl, { ...options, width });
      return `${url} ${width}w`;
    })
    .join(', ');
}

/**
 * Generate picture element sources for different formats
 */
export function generatePictureSources(
  originalUrl: string,
  widths: number[] = [640, 1024, 1536],
  options: Omit<ImageProcessingOptions, 'format' | 'width'> = {}
): Array<{ type: string; srcset: string }> {
  const formats: Array<{ format: 'avif' | 'webp' | 'jpeg'; type: string }> = [
    { format: 'avif', type: 'image/avif' },
    { format: 'webp', type: 'image/webp' },
    { format: 'jpeg', type: 'image/jpeg' },
  ];

  return formats.map(({ format, type }) => ({
    type,
    srcset: generateSrcSet(originalUrl, widths, { ...options, format }),
  }));
}

// ============================================
// Image Analysis
// ============================================

/**
 * Get image dimensions from URL (requires fetching the image)
 */
export async function getImageDimensions(
  imageUrl: string
): Promise<{ width: number; height: number } | null> {
  try {
    // Use Cloudflare Image Resizing with format=json to get metadata
    const metadataUrl = getOptimizedImageUrl(imageUrl, { format: 'json' });
    const response = await fetch(metadataUrl);
    
    if (!response.ok) return null;
    
    const data = await response.json() as any;
    return {
      width: data.width,
      height: data.height,
    };
  } catch {
    return null;
  }
}

/**
 * Check if image URL is valid and accessible
 */
export async function validateImageUrl(imageUrl: string): Promise<{
  valid: boolean;
  contentType?: string;
  size?: number;
  error?: string;
}> {
  try {
    const response = await fetch(imageUrl, { method: 'HEAD' });
    
    if (!response.ok) {
      return { valid: false, error: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');

    if (!contentType?.startsWith('image/')) {
      return { valid: false, error: 'Not an image' };
    }

    return {
      valid: true,
      contentType,
      size: contentLength ? parseInt(contentLength) : undefined,
    };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}

// ============================================
// Preset Configurations
// ============================================

export const ImagePresets = {
  thumbnail: {
    width: 150,
    height: 150,
    fit: 'cover' as const,
    quality: 80,
    format: 'webp' as const,
  },
  small: {
    width: 320,
    fit: 'scale-down' as const,
    quality: 85,
    format: 'webp' as const,
  },
  medium: {
    width: 640,
    fit: 'scale-down' as const,
    quality: 85,
    format: 'webp' as const,
  },
  large: {
    width: 1024,
    fit: 'scale-down' as const,
    quality: 85,
    format: 'webp' as const,
  },
  xlarge: {
    width: 1536,
    fit: 'scale-down' as const,
    quality: 85,
    format: 'webp' as const,
  },
  product: {
    width: 800,
    height: 800,
    fit: 'contain' as const,
    quality: 90,
    format: 'webp' as const,
    background: 'ffffff',
  },
  productThumb: {
    width: 200,
    height: 200,
    fit: 'contain' as const,
    quality: 85,
    format: 'webp' as const,
    background: 'ffffff',
  },
  og: {
    width: 1200,
    height: 630,
    fit: 'cover' as const,
    quality: 90,
    format: 'jpeg' as const,
  },
  avatar: {
    width: 100,
    height: 100,
    fit: 'cover' as const,
    quality: 85,
    format: 'webp' as const,
  },
};

/**
 * Get optimized URL using a preset
 */
export function getPresetImageUrl(
  originalUrl: string,
  preset: keyof typeof ImagePresets
): string {
  return getOptimizedImageUrl(originalUrl, ImagePresets[preset]);
}

// ============================================
// Batch Processing
// ============================================

interface BatchProcessResult {
  original: string;
  optimized: Record<string, string>;
  error?: string;
}

/**
 * Process multiple images with multiple presets
 */
export function batchProcessImages(
  imageUrls: string[],
  presets: (keyof typeof ImagePresets)[] = ['thumbnail', 'medium', 'large']
): BatchProcessResult[] {
  return imageUrls.map((url) => {
    try {
      const optimized: Record<string, string> = {};
      for (const preset of presets) {
        optimized[preset] = getPresetImageUrl(url, preset);
      }
      return { original: url, optimized };
    } catch (error: any) {
      return { original: url, optimized: {}, error: error.message };
    }
  });
}

// ============================================
// Helper to generate HTML picture element
// ============================================

export function generatePictureHtml(
  originalUrl: string,
  alt: string,
  options: {
    widths?: number[];
    lazy?: boolean;
    className?: string;
    sizes?: string;
  } = {}
): string {
  const {
    widths = [640, 1024, 1536],
    lazy = true,
    className = '',
    sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  } = options;

  const sources = generatePictureSources(originalUrl, widths);
  const fallbackUrl = getOptimizedImageUrl(originalUrl, {
    width: widths[widths.length - 1],
    format: 'jpeg',
    quality: 85,
  });

  const loadingAttr = lazy ? 'loading="lazy"' : '';
  const classAttr = className ? `class="${className}"` : '';

  const sourceHtml = sources
    .map((s) => `<source type="${s.type}" srcset="${s.srcset}" sizes="${sizes}">`)
    .join('\n    ');

  return `<picture>
    ${sourceHtml}
    <img src="${fallbackUrl}" alt="${alt}" ${loadingAttr} ${classAttr} sizes="${sizes}">
  </picture>`;
}
