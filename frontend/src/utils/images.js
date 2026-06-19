/**
 * Resolve image URL for display.
 * New uploads use Cloudinary; older records fall back to the API proxy.
 */
export function getImageUrl(image, submissionId) {
  if (image?.image_url) return image.image_url;
  if (image?.image_id && submissionId) {
    return `/api/submissions/${submissionId}/images/${image.image_id}`;
  }
  return null;
}
