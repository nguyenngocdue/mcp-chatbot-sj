export function withCors(headers: HeadersInit = {}) {
  return {
    ...headers,
    'Access-Control-Allow-Origin': '*', // hoặc 'http://localhost:3000'
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}