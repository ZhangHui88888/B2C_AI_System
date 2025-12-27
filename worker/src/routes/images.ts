/**
 * Image Processing API Routes
 * Compression, WebP conversion, optimization
 */

import type { Env } from '../index';
import { getSupabase } from '../utils/supabase';
import { jsonResponse, errorResponse } from '../utils/response';
import { getBrandId } from '../middleware/brand';
import {
  uploadToCloudflareImages,
  deleteFromCloudflareImages,
  getOptimizedImageUrl,
  getPresetImageUrl,
  generateSrcSet,
  generatePictureSources,
  validateImageUrl,
  ImagePresets,
  batchProcessImages,
} from '../utils/image-processing';

export async function handleImages(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const supabase = getSupabase(env);
  const brandId = getBrandId(request);

  if (!brandId) {
    return errorResponse('Brand context missing', 500);
  }

  // POST /api/images/upload - Upload and optimize image
  if (request.method === 'POST' && path === '/api/images/upload') {
    return await uploadImage(env, brandId, request);
  }

  // DELETE /api/images/:id - Delete image
  if (request.method === 'DELETE' && path.match(/^\/api\/images\/[^/]+$/)) {
    const imageId = path.replace('/api/images/', '');
    return await deleteImage(env, imageId);
  }

  // GET /api/images/optimize - Get optimized URL
  if (request.method === 'GET' && path === '/api/images/optimize') {
    return await optimizeImage(request);
  }

  // POST /api/images/batch-optimize - Batch optimize URLs
  if (request.method === 'POST' && path === '/api/images/batch-optimize') {
    return await batchOptimize(request);
  }

  // GET /api/images/srcset - Generate srcset
  if (request.method === 'GET' && path === '/api/images/srcset') {
    return await getSrcSet(request);
  }

  // GET /api/images/picture - Generate picture sources
  if (request.method === 'GET' && path === '/api/images/picture') {
    return await getPictureSources(request);
  }

  // GET /api/images/validate - Validate image URL
  if (request.method === 'GET' && path === '/api/images/validate') {
    return await validateImage(request);
  }

  // GET /api/images/presets - List available presets
  if (request.method === 'GET' && path === '/api/images/presets') {
    return jsonResponse({ presets: ImagePresets });
  }

  return errorResponse('Not found', 404);
}

// ============================================
// Upload Image
// ============================================

async function uploadImage(
  env: Env,
  brandId: string,
  request: Request
): Promise<Response> {
  try {
    const contentType = request.headers.get('content-type') || '';

    let imageData: Blob;
    let filename: string | undefined;
    let metadata: Record<string, string> = { brand_id: brandId };

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      
      if (!file) {
        return errorResponse('No file provided', 400);
      }

      imageData = file;
      filename = file.name;

      // Get additional metadata from form
      const customMetadata = formData.get('metadata');
      if (customMetadata && typeof customMetadata === 'string') {
        try {
          metadata = { ...metadata, ...JSON.parse(customMetadata) };
        } catch {}
      }
    } else if (contentType.includes('application/json')) {
      // URL-based upload
      const body = await request.json() as any;
      const { url, metadata: customMetadata } = body;

      if (!url) {
        return errorResponse('No URL provided', 400);
      }

      // Fetch image from URL
      const imageResponse = await fetch(url);
      if (!imageResponse.ok) {
        return errorResponse('Failed to fetch image from URL', 400);
      }

      imageData = await imageResponse.blob();
      filename = url.split('/').pop()?.split('?')[0];
      
      if (customMetadata) {
        metadata = { ...metadata, ...customMetadata };
      }
    } else {
      // Raw binary upload
      const arrayBuffer = await request.arrayBuffer();
      imageData = new Blob([arrayBuffer]);
    }

    // Validate image type
    if (!imageData.type.startsWith('image/')) {
      return errorResponse('Invalid file type. Only images are allowed.', 400);
    }

    // Check file size (max 10MB)
    if (imageData.size > 10 * 1024 * 1024) {
      return errorResponse('File too large. Maximum size is 10MB.', 400);
    }

    // Upload to Cloudflare Images
    const result = await uploadToCloudflareImages(env, imageData, metadata);

    if (!result.success) {
      return errorResponse(result.error || 'Upload failed', 500);
    }

    // Generate optimized variants
    const variants: Record<string, string> = {};
    if (result.url) {
      variants.original = result.url;
      variants.thumbnail = getPresetImageUrl(result.url, 'thumbnail');
      variants.small = getPresetImageUrl(result.url, 'small');
      variants.medium = getPresetImageUrl(result.url, 'medium');
      variants.large = getPresetImageUrl(result.url, 'large');
      variants.product = getPresetImageUrl(result.url, 'product');
    }

    return jsonResponse({
      success: true,
      id: result.id,
      url: result.url,
      variants,
      filename,
    }, 201);
  } catch (error: any) {
    console.error('Upload image error:', error);
    return errorResponse(error.message || 'Failed to upload image', 500);
  }
}

// ============================================
// Delete Image
// ============================================

async function deleteImage(env: Env, imageId: string): Promise<Response> {
  try {
    const result = await deleteFromCloudflareImages(env, imageId);

    if (!result.success) {
      return errorResponse(result.error || 'Delete failed', 500);
    }

    return jsonResponse({ success: true });
  } catch (error: any) {
    console.error('Delete image error:', error);
    return errorResponse(error.message || 'Failed to delete image', 500);
  }
}

// ============================================
// Optimize Image URL
// ============================================

async function optimizeImage(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const imageUrl = url.searchParams.get('url');
    const preset = url.searchParams.get('preset') as keyof typeof ImagePresets | null;

    if (!imageUrl) {
      return errorResponse('url parameter is required', 400);
    }

    let optimizedUrl: string;

    if (preset && ImagePresets[preset]) {
      optimizedUrl = getPresetImageUrl(imageUrl, preset);
    } else {
      // Build options from query params
      const options: any = {};
      
      const width = url.searchParams.get('width');
      const height = url.searchParams.get('height');
      const quality = url.searchParams.get('quality');
      const format = url.searchParams.get('format');
      const fit = url.searchParams.get('fit');

      if (width) options.width = parseInt(width);
      if (height) options.height = parseInt(height);
      if (quality) options.quality = parseInt(quality);
      if (format) options.format = format;
      if (fit) options.fit = fit;

      optimizedUrl = getOptimizedImageUrl(imageUrl, options);
    }

    return jsonResponse({
      original: imageUrl,
      optimized: optimizedUrl,
      preset: preset || null,
    });
  } catch (error: any) {
    console.error('Optimize image error:', error);
    return errorResponse(error.message || 'Failed to optimize image', 500);
  }
}

// ============================================
// Batch Optimize
// ============================================

async function batchOptimize(request: Request): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { urls, presets } = body;

    if (!Array.isArray(urls) || urls.length === 0) {
      return errorResponse('urls array is required', 400);
    }

    if (urls.length > 100) {
      return errorResponse('Maximum 100 URLs per batch', 400);
    }

    const validPresets = presets?.filter((p: string) => ImagePresets[p as keyof typeof ImagePresets]) || 
      ['thumbnail', 'medium', 'large'];

    const results = batchProcessImages(urls, validPresets);

    return jsonResponse({
      success: true,
      count: results.length,
      results,
    });
  } catch (error: any) {
    console.error('Batch optimize error:', error);
    return errorResponse(error.message || 'Failed to batch optimize', 500);
  }
}

// ============================================
// Generate SrcSet
// ============================================

async function getSrcSet(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const imageUrl = url.searchParams.get('url');
    const widthsParam = url.searchParams.get('widths');
    const format = url.searchParams.get('format') as 'webp' | 'avif' | 'jpeg' | null;
    const quality = url.searchParams.get('quality');

    if (!imageUrl) {
      return errorResponse('url parameter is required', 400);
    }

    const widths = widthsParam
      ? widthsParam.split(',').map((w) => parseInt(w.trim())).filter((w) => !isNaN(w))
      : [320, 640, 768, 1024, 1280, 1536];

    const options: any = {};
    if (format) options.format = format;
    if (quality) options.quality = parseInt(quality);

    const srcset = generateSrcSet(imageUrl, widths, options);

    return jsonResponse({
      url: imageUrl,
      srcset,
      widths,
    });
  } catch (error: any) {
    console.error('Generate srcset error:', error);
    return errorResponse(error.message || 'Failed to generate srcset', 500);
  }
}

// ============================================
// Generate Picture Sources
// ============================================

async function getPictureSources(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const imageUrl = url.searchParams.get('url');
    const widthsParam = url.searchParams.get('widths');
    const quality = url.searchParams.get('quality');

    if (!imageUrl) {
      return errorResponse('url parameter is required', 400);
    }

    const widths = widthsParam
      ? widthsParam.split(',').map((w) => parseInt(w.trim())).filter((w) => !isNaN(w))
      : [640, 1024, 1536];

    const options: any = {};
    if (quality) options.quality = parseInt(quality);

    const sources = generatePictureSources(imageUrl, widths, options);

    return jsonResponse({
      url: imageUrl,
      sources,
      widths,
    });
  } catch (error: any) {
    console.error('Generate picture sources error:', error);
    return errorResponse(error.message || 'Failed to generate picture sources', 500);
  }
}

// ============================================
// Validate Image URL
// ============================================

async function validateImage(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const imageUrl = url.searchParams.get('url');

    if (!imageUrl) {
      return errorResponse('url parameter is required', 400);
    }

    const result = await validateImageUrl(imageUrl);

    return jsonResponse(result);
  } catch (error: any) {
    console.error('Validate image error:', error);
    return errorResponse(error.message || 'Failed to validate image', 500);
  }
}
