import { readFile } from "node:fs/promises";
import path from "node:path";
import { getDocsRoot, isMissingDoc } from "~/server/docs";

const contentTypes: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: parts } = await params;
  const contentType = contentTypes[path.extname(parts.at(-1) ?? "")];
  if (
    !["images", "logo"].includes(parts[0] ?? "") ||
    !parts.every((part) => /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(part)) ||
    !contentType
  ) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const file = await readFile(path.join(getDocsRoot(), ...parts));
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    if (isMissingDoc(error)) return new Response("Not found", { status: 404 });
    throw error;
  }
}
