import { staticModelRepository } from '@/lib/db/pg/repositories/static-model-repository.pg';
import { SESSION } from '@/app/globals';
import { jsonHeaders } from '@/app/globals';

export const runtime = 'nodejs';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const name = searchParams.get('name');
        const userId = SESSION.user.id;
        if (!name) {
            return new Response(JSON.stringify({ error: 'Missing name' }), {
                status: 400,
                headers: jsonHeaders(),
            });
        }
        const model = await staticModelRepository.getByName(name, userId);
        if (!model) {
            return new Response(JSON.stringify({ error: 'Not found' }), {
                status: 404,
                headers: jsonHeaders(),
            });
        }
        return new Response(JSON.stringify(model), {
            status: 200,
            headers: jsonHeaders(),
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message || 'server error' }), {
            status: 500,
            headers: jsonHeaders(),
        });
    }
}

export async function POST(req: Request) {
    try {
        const { name, apiKey } = await req.json();
        const userId = SESSION.user.id;
        if (!name || !apiKey) {
            return new Response(JSON.stringify({ error: 'Missing name or apiKey' }), {
                status: 400,
                headers: jsonHeaders(),
            });
        }
        // Upsert static model for this user (update if exists, insert if not)
        const model = await staticModelRepository.upsert({ name, apiKey, userId });
        return new Response(JSON.stringify(model), {
            status: 201,
            headers: jsonHeaders(),
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message || 'server error' }), {
            status: 500,
            headers: jsonHeaders(),
        });
    }
}

export async function DELETE(req: Request) {
    try {
        const { id } = await req.json();
        const userId = SESSION.user.id;
        if (!id) {
            return new Response(JSON.stringify({ error: 'Missing id' }), {
                status: 400,
                headers: jsonHeaders(),
            });
        }
        const model = await staticModelRepository.findById(id);
        if (!model || model.userId !== userId) {
            return new Response(JSON.stringify({ error: 'Not found or forbidden' }), {
                status: 404,
                headers: jsonHeaders(),
            });
        }
        await staticModelRepository.delete(id);
        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: jsonHeaders(),
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message || 'server error' }), {
            status: 500,
            headers: jsonHeaders(),
        });
    }
}

export async function PUT(req: Request) {
    try {
        const { id, name, apiKey } = await req.json();
        const userId = SESSION.user.id;
        if (!id) {
            return new Response(JSON.stringify({ error: 'Missing id' }), {
                status: 400,
                headers: jsonHeaders(),
            });
        }
        // Optional: check ownership
        const model = await staticModelRepository.findById(id);
        if (!model || model.userId !== userId) {
            return new Response(JSON.stringify({ error: 'Not found or forbidden' }), {
                status: 404,
                headers: jsonHeaders(),
            });
        }
        const updated = await staticModelRepository.update(id, { name, apiKey });
        return new Response(JSON.stringify(updated), {
            status: 200,
            headers: jsonHeaders(),
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message || 'server error' }), {
            status: 500,
            headers: jsonHeaders(),
        });
    }
}

export { OPTIONS } from '@/app/globals';
