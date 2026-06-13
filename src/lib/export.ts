import { apiDownload } from "./api";

export async function downloadExport(
  path: string,
  params: Record<string, string | number | undefined>
): Promise<void> {
  const { blob, filename } = await apiDownload(path, params);

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
