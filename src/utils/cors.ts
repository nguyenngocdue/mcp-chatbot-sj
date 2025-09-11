export function withCors(headers: HeadersInit = {}) {
  return {
    ...headers,
    'Access-Control-Allow-Origin': '*', // or 'http://localhost:3000'
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}