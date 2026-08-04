import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Extracts storage object path from a Supabase public storage URL or raw path.
 * Handles single URLs and comma-separated URL lists.
 * E.g.: "https://xyz.supabase.co/storage/v1/object/public/inspection_photos/inspection_123.jpg" -> "inspection_123.jpg"
 */
export function extractStoragePaths(urlOrPathString: string | null | undefined, bucketName: string): string[] {
  if (!urlOrPathString) return [];
  const items = urlOrPathString.split(',').map((s) => s.trim()).filter(Boolean);
  const paths: string[] = [];

  const marker = `/storage/v1/object/public/${bucketName}/`;
  const altMarker = `/${bucketName}/`;

  for (const item of items) {
    if (!item) continue;
    if (item.includes(marker)) {
      const rawPath = item.split(marker)[1];
      if (rawPath) paths.push(decodeURIComponent(rawPath.split('?')[0]));
    } else if (item.includes(altMarker)) {
      const rawPath = item.split(altMarker)[1];
      if (rawPath) paths.push(decodeURIComponent(rawPath.split('?')[0]));
    } else if (!item.startsWith('http://') && !item.startsWith('https://')) {
      paths.push(item);
    }
  }

  return Array.from(new Set(paths));
}

/**
 * Removes files from a specified Supabase storage bucket based on URLs or paths.
 */
export async function deleteStorageFiles(
  supabase: SupabaseClient,
  bucketName: string,
  urlsOrPaths: (string | null | undefined)[]
) {
  const allPaths: string[] = [];
  for (const input of urlsOrPaths) {
    const extracted = extractStoragePaths(input, bucketName);
    allPaths.push(...extracted);
  }

  const uniquePaths = Array.from(new Set(allPaths));
  if (uniquePaths.length > 0) {
    const { error } = await supabase.storage.from(bucketName).remove(uniquePaths);
    if (error) {
      console.warn(`Failed to remove files from bucket ${bucketName}:`, error.message);
    }
  }
}
