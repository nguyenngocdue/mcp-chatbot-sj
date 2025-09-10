import type { UIMessage } from "ai";

export type DBThreadMessage = {
  id: string;
  role: "user" | "assistant" | "system" | string;
  parts?: any[] | null;
  content?: string | null;
  metadata?: unknown;
};

function sanitizePart(part: any) {
  if (!part || typeof part !== "object") return part;
  const { providerMetadata, callProviderMetadata, ...rest } = part;
  return rest;
}

function toParts(m: DBThreadMessage): any[] {
  if (Array.isArray(m.parts) && m.parts.length > 0) {
    return m.parts.map(sanitizePart);
  }
  if (typeof m.content === "string" && m.content.trim().length > 0) {
    return [{ type: "text", text: m.content.trim(), state: "done" }];
  }
  return [];
}

function normalizeRole(role?: string): "user" | "assistant" | "system" {
  return role === "assistant" || role === "system" ? role : "user";
}

export function normalizeThreadMessagesToUI(
  thread?: { messages?: DBThreadMessage[] | null }
): UIMessage[] {
  return (thread?.messages ?? [])
    .filter(Boolean)
    .map((m) => {
      const parts = toParts(m as DBThreadMessage);
      return {
        id: (m as DBThreadMessage).id,
        role: normalizeRole((m as DBThreadMessage).role),
        parts,
        metadata: (m as DBThreadMessage).metadata ?? undefined,
      } as UIMessage;
    })
    .filter((msg) => Array.isArray(msg.parts) && msg.parts.length > 0);
}


export function convertToSavePart(part: any) {
  if (!part || typeof part !== "object") return part;
  // bỏ metadata nhà cung cấp cho gọn DB
  const { providerMetadata, callProviderMetadata, ...rest } = part;
  // ví dụ: ẩn kết quả history nặng (nếu bạn dùng workflow-stream)
  if (rest?.type === "tool" && typeof rest?.state === "string" && rest.state.startsWith("output")) {
    const out = rest.output;
    if (out && out.__tag === "workflow-stream" && Array.isArray(out.history)) {
      return {
        ...rest,
        output: {
          ...out,
          history: out.history.map((h: any) => ({ ...h, result: undefined })),
        },
      };
    }
  }
  return rest;
}