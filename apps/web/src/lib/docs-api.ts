import { z } from "zod";

const operationSchema = z.object({
  summary: z.string().optional(),
  description: z.string().optional(),
  parameters: z.array(z.unknown()).optional(),
  requestBody: z.unknown().optional(),
  responses: z.record(z.unknown()),
});
const documentSchema = z.object({
  paths: z.record(z.record(z.unknown())),
  components: z
    .object({ schemas: z.record(z.unknown()).optional() })
    .optional(),
});

export function getDocOperation(document: unknown, operation: string) {
  const match = /^(get|post|put|patch|delete)\s+(\/\S+)$/i.exec(operation);
  if (!match) throw new Error(`Invalid documentation operation: ${operation}`);
  const method = match[1]!.toLowerCase();
  const path = match[2]!;
  const spec = documentSchema.parse(document);
  const definition = spec.paths[path]?.[method];
  if (!definition) throw new Error(`API operation not found: ${operation}`);
  return {
    method: method.toUpperCase(),
    path,
    ...operationSchema.parse(definition),
    schemas: spec.components?.schemas,
  };
}
