// src/app/api/ai-chat/route.ts
import { createOpenAI } from '@ai-sdk/openai';
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  convertToModelMessages,
  smoothStream,
  stepCountIs,
  streamText,
} from 'ai';
import { chatApiSchemaRequestBodySchema } from '../../../types/chat';
import { withCors } from '../../../utils/cors';
import { customModelProvider, isToolCallUnsupportedModel } from '../../../lib/ai/models';
import { errorIf, safe } from 'ts-safe';
import { loadAppDefaultTools, mergeSystemPrompt } from '../chat/shared.chat';
import { buildMcpServerCustomizationsSystemPrompt, buildToolCallUnsupportedModelSystemPrompt, buildUserSystemPrompt } from 'lib/ai/prompts';

export const runtime = 'nodejs';



// Helper function, not exported
function hasMarkdownTable(parts: any[]): boolean {
  // Check if any text part contains a markdown table (at least one line with | ... | ... |)
  // The regex looks for a line break followed by a line with at least two columns separated by |
  return parts.some(
    (p) => p.type === "text" && /\n\s*\|.*\|.*\n/.test(p.text)
  );
}

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => ({}));
    console.log('[DEBUG] raw body:', json);

    // ✅ Parse theo schema (chỉ có `message`, không có `messages[]`)
    const {
      id,
      message,
      chatModel,
      toolChoice,
      allowedAppDefaultToolkit,
      allowedMcpServers,
      mentions = [],
    } = chatApiSchemaRequestBodySchema.parse(json);

    // console.log('[DEBUG] id:', id);
    // console.log('[DEBUG] chatModel:', chatModel);
    // console.log('[DEBUG] toolChoice:', toolChoice);
    // console.log('[DEBUG] allowedAppDefaultToolkit:', allowedAppDefaultToolkit);
    // console.log('[DEBUG] allowedMcpServers:', allowedMcpServers);
    // console.log('[DEBUG] mentions:', mentions);
    // console.log('[DEBUG] message:', message);

    // Vì schema chỉ có 1 message → dùng mảng [message] cho model
    const allMessages = [message];
    const model = customModelProvider.getModel(chatModel);
    const supportToolCall = !isToolCallUnsupportedModel(model);
    const isToolCallAllowed = supportToolCall && (toolChoice != "none" || mentions.length > 0);
    // console.log('[DEBUG] model:', model);
    console.log('[DEBUG] supportToolCall:', supportToolCall);



    const stream = createUIMessageStream({
      originalMessages: allMessages,
      execute: async ({ writer }) => {
        // const mcpClients = await mcpClientsManager.getClients();
        // const mcpTools = await mcpClientsManager.tools();
        // logger.info(
        //   `mcp-server count: ${mcpClients.length}, mcp-tools count :${Object.keys(mcpTools).length}`,
        // );
         const APP_DEFAULT_TOOLS = await safe()
          .map(errorIf(() => !isToolCallAllowed && "Not allowed"))
          .map(() =>
            loadAppDefaultTools({
              mentions,
              allowedAppDefaultToolkit,
            }),
          )
          .orElse({});

             const systemPrompt = mergeSystemPrompt(
              buildUserSystemPrompt(),
              !supportToolCall && buildToolCallUnsupportedModelSystemPrompt,
            );


          const vercelAITools = safe()
          .map((t) => {
            return {
              ...APP_DEFAULT_TOOLS, // APP_DEFAULT_TOOLS Not Supported Manual
            };
          })
          .unwrap();

          console.log('[DEBUG] APP_DEFAULT_TOOLS: ' , APP_DEFAULT_TOOLS)
          console.log('[DEBUG] systemPrompt: ' , systemPrompt)


        const result = await streamText({
          model: model,
          system: systemPrompt,
          messages: convertToModelMessages(allMessages),
          temperature: 0.2,
          tools: vercelAITools,
          experimental_transform: smoothStream({ chunking: 'word' }),
          stopWhen: stepCountIs(10),
          abortSignal: (req as any).signal,
          toolChoice: "auto",
          maxRetries: 2,
        });

        result.consumeStream();

        writer.merge(
          result.toUIMessageStream({
            messageMetadata: ({ part }) =>
              part.type === 'finish'
                ? {
                    usage: part.totalUsage,
                    chatModel: chatModel ?? { provider: 'openai', model: 'gpt-4o-mini' },
                    toolChoice,
                    mentionsCount: mentions.length,
                  }
                : undefined,
          })
        );
      },
      onFinish: async ({ responseMessage }) => {
        // Nếu có markdown table thì loại bỏ các tool part để tránh lặp UI
        if (responseMessage && Array.isArray(responseMessage.parts) && hasMarkdownTable(responseMessage.parts)) {
          responseMessage.parts = responseMessage.parts.filter(
            (p: any) => p.type !== 'tool'
          );
        }
        console.log("[DEBUG] responseMessage:", responseMessage)
      }
    });

    return createUIMessageStreamResponse({ stream, headers: withCors() });
  } catch (err: any) {
    console.error('[ERROR]', err);
    return new Response(JSON.stringify({ error: err?.message || 'server error' }), {
      status: 500,
      headers: withCors({ 'content-type': 'application/json' }),
    });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: withCors() });
}

export async function GET() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: withCors({ 'content-type': 'application/json' }),
  });
}
