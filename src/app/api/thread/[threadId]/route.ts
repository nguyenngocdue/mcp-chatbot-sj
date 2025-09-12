import { chatRepository } from 'lib/db/repository';
import logger from 'lib/logger';
import { OPTIONS, SESSION, jsonHeaders } from '@/app/globals';

export { OPTIONS };

export async function GET(
  request: Request,
  context: { params: { threadId: string } }
) {
  const { params } = context;
  const threadId = params.threadId;

  try {
    if (!threadId) {
      return new Response(JSON.stringify({ error: 'Missing threadId' }), {
        status: 400,
        headers: jsonHeaders(),
      });
    }
    const thread = await chatRepository.selectThread(threadId);
    if (!thread) {
      logger.error('Thread not found', threadId);
      return new Response(JSON.stringify({ error: 'Thread not found' }), {
        status: 404,
        headers: jsonHeaders(),
      });
    }
    if (thread.userId !== SESSION?.user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: jsonHeaders(),
      });
    }
    const messages = await chatRepository.selectMessagesByThreadId(threadId);
    return new Response(
      JSON.stringify({ ...thread, messages: messages ?? [] }),
      {
        status: 200,
        headers: jsonHeaders(),
      }
    );
  } catch (err: any) {
    logger.error('API error', err);
    return new Response(JSON.stringify({ error: err?.message || 'server error' }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }
}


/**
 * DELETE /api/thread/[threadId]
 * Delete a thread by its ID if the current user is the owner.
 * Returns 200 with { success: true } if deleted, 404 if not found, 403 if forbidden.
 * Requires: threadId in params, SESSION.user.id for permission check.
 */
export async function DELETE(
  req: Request,
  { params }: { params: { threadId: string } }
) {
  try {
    const threadId = params.threadId;
    if (!threadId) {
      return new Response(JSON.stringify({ error: 'Missing threadId' }), {
        status: 400,
        headers: jsonHeaders(),
      });
    }
    const thread = await chatRepository.selectThread(threadId);
    if (!thread) {
      return new Response(JSON.stringify({ error: 'Thread not found' }), {
        status: 404,
        headers: jsonHeaders(),
      });
    }
    if (thread.userId !== SESSION?.user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: jsonHeaders(),
      });
    }
    await chatRepository.deleteThread(threadId);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: jsonHeaders(),
    });
  } catch (err: any) {
    logger.error('API error', err);
    return new Response(JSON.stringify({ error: err?.message || 'server error' }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }
}


