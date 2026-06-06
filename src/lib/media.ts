export function getPhotoUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  const base =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/api$/, "") ??
    "http://localhost:5000";
  return `${base}${url}`;
}
