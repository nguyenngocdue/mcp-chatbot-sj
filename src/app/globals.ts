import { withCors } from '@/utils/cors';

// mock data
export const SESSION = {
  user: {
    id: "ad6df675-8780-4726-b2e5-a20e57433c6f"
  }
};

// Returns CORS + JSON content-type headers for API responses
export function jsonHeaders() {
  return withCors({ 'content-type': 'application/json' });
}

// Enable CORS preflight for all methods
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: jsonHeaders() });
}

export const AGENT = { id: "default-agent-id" };
