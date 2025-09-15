import { staticModelRepository } from '@/lib/db/pg/repositories/static-model-repository.pg';
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  convertToModelMessages,
  smoothStream,
  stepCountIs,
  streamText,
} from 'ai';
import { chatApiSchemaRequestBodySchema, ChatMetadata } from '../../../types/chat';
import { withCors } from '../../../utils/cors';
import { customModelProvider, isToolCallUnsupportedModel } from '../../../lib/ai/models';
import { errorIf, safe } from 'ts-safe';
import { convertToSavePart, loadAppDefaultTools, mergeSystemPrompt } from '../chat/shared.chat';
import { buildToolCallUnsupportedModelSystemPrompt, buildUserSystemPrompt } from 'lib/ai/prompts';
import { chatRepository, userRepository } from 'lib/db/repository';
import { AGENT, SESSION } from '@/app/globals';
import { createOpenAI } from '@ai-sdk/openai';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => ({}));
    console.log('[DEBUG] raw body:', json);

    const {
      id, // using this one for threadId
      message,
      chatModel,
      toolChoice,
      allowedAppDefaultToolkit,
      allowedMcpServers,
      mentions = [],
    } = chatApiSchemaRequestBodySchema.parse(json);


    // Because the schema only has 1 message → use [message] array for the model
    const allMessages = [message];

    // set OPENAI-Key from FE
    // Lấy apiKey từ static_models nếu không truyền trực tiếp
    let apiKey = process.env.OPENAI_API_KEY;
    // Ưu tiên lấy apiKey từ static_models theo tên model (chatModel.model)
    if (!apiKey && chatModel && chatModel.model) {
      apiKey = await getApiKeyFromStaticModel(chatModel.model, SESSION.user.id);
    }
    if (!apiKey && chatModel && chatModel.apiKey) {
      apiKey = chatModel.apiKey;
    }
    const openaiWithKey = createOpenAI({ apiKey: apiKey || '' });
    const model = openaiWithKey((chatModel && chatModel.model) ? chatModel.model : ( process.env.OPENAI_MODEL ||  "gpt-4.1-mini"));
    console.log('[apiKey] ' , apiKey)

    // for set other model
    // const model = customModelProvider.getModel(chatModel);
    // const model = customModelProvider.getModel({
    //   provider: 'openRouter',
    //   model: 'deepseek-r1-0528-qwen3-8b:free',
    // });
    // console.log('[DEBUG] model:', model);


    const supportToolCall = !isToolCallUnsupportedModel(model);
    const isToolCallAllowed = supportToolCall && (toolChoice != "none" || mentions.length > 0);
    // console.log('[DEBUG] supportToolCall:', supportToolCall);

    // STEP 0: Ensure user exists (create if not)
    const userId = SESSION.user.id;
    let user = await userRepository.findById(userId);
    if (!user) {
      // You can customize name/email as needed
      if (typeof userRepository.insertUser === 'function') {
        user = await userRepository.insertUser({
          id: userId,
          name: 'Mock User',
          email: `mockuser_${userId}@example.com`,
          image: null,
        });
      } else {
        throw new Error('userRepository.insertUser is not implemented');
      }
    }

    // STEP 1: Save value to chat_threads
    let thread = await chatRepository.selectThreadDetails(id);
    if (!thread) {
      const newThread = await chatRepository.insertThread({
        id,
        title: "Create a New Thread",
        userId: SESSION.user.id,
      });
      thread = await chatRepository.selectThreadDetails(newThread.id);
    }


    const metadata: ChatMetadata = {
      agentId: AGENT?.id,
      toolChoice: toolChoice,
      toolCount: 0,
      chatModel: chatModel,
    };



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

        // console.log('[DEBUG] APP_DEFAULT_TOOLS: ' , APP_DEFAULT_TOOLS)
        // console.log('[DEBUG] systemPrompt: ' , systemPrompt)


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
        console.log("[DEBUG] responseMessage:", responseMessage);
        console.log("[DEBUG] message:", message);
        if (!thread || !thread.id) {
          console.error("Thread or thread.id is missing. Cannot upsert message.");
          return;
        }
        // Case 1: The response message is an update to the user's own message (same id), so only one message is saved or updated.
        if (responseMessage.id == message.id) {
          await chatRepository.upsertMessage({
            threadId: thread.id,
            ...responseMessage,
            parts: responseMessage.parts.map(convertToSavePart),
            metadata,
          });
          // Case 2: The response message is a new assistant message (different id), so save both the user's message and the assistant's response as separate records.
        } else {
          await chatRepository.upsertMessage({
            threadId: thread.id,
            role: message.role,
            parts: message.parts.map(convertToSavePart),
            id: message.id,
          });
          await chatRepository.upsertMessage({
            threadId: thread.id,
            role: responseMessage.role,
            id: responseMessage.id,
            parts: responseMessage.parts.map(convertToSavePart),
            metadata,
          });
        }
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

// Helper to get apiKey from static_models by model name and userId
async function getApiKeyFromStaticModel(modelName: string, userId: string): Promise<string | undefined> {
  if (!modelName || !userId) return undefined;
  const model = await staticModelRepository.getByName(modelName, userId);
  return model?.apiKey;
}