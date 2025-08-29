import { NextRequest, NextResponse } from 'next/server';

// rate limiting configuration
const RATE_LIMITS = {
  create: { max: 5, window: 60 * 1000 }, // 5 requests per minute
  read: { max: 20, window: 60 * 1000 },  // 20 requests per minute
  cleanup: { max: 2, window: 60 * 1000 }, // 2 cleanup requests per minute
  global: { max: 100, window: 60 * 1000 } // 100 requests per minute
};

// in-memory rate limit store (consider Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// extracts client IP from request headers
function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0] || 
         request.headers.get('x-real-ip') || 
         'unknown';
}

// checks if request exceeds rate limit
function checkRateLimit(clientIP: string, type: 'create' | 'read' | 'cleanup' | 'global'): boolean {
  const now = Date.now();
  const key = `${clientIP}:${type}`;
  const limit = RATE_LIMITS[type];
  
  const record = rateLimitStore.get(key);
  
  if (!record || now > record.resetTime) {
    // first request or window expired
    rateLimitStore.set(key, { count: 1, resetTime: now + limit.window });
    return true;
  }
  
  if (record.count >= limit.max) {
    return false; // rate limit exceeded
  }
  
  record.count++;
  return true;
}

// applies rate limiting and security headers to all requests
export function middleware(request: NextRequest) {
  const clientIP = getClientIP(request);
  const pathname = request.nextUrl.pathname;
  
  // global rate limiting
  if (!checkRateLimit(clientIP, 'global')) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }
  
  // specific rate limiting for API endpoints
  if (pathname === '/api/note' && request.method === 'POST') {
    if (!checkRateLimit(clientIP, 'create')) {
      return NextResponse.json(
        { error: 'Too many messages created. Please try again later.' },
        { status: 429 }
      );
    }
  }
  
  if (pathname.startsWith('/api/note/') && pathname.endsWith('/data') && request.method === 'POST') {
    if (!checkRateLimit(clientIP, 'read')) {
      return NextResponse.json(
        { error: 'Too many message requests. Please try again later.' },
        { status: 429 }
      );
    }
  }
  
  if (pathname === '/api/cleanup' && request.method === 'POST') {
    if (!checkRateLimit(clientIP, 'cleanup')) {
      return NextResponse.json(
        { error: 'Too many cleanup requests. Please try again later.' },
        { status: 429 }
      );
    }
  }
  
  // apply security headers
  const response = NextResponse.next();
  
  // set CSP headers based on environment
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (isDevelopment) {
    // development CSP - more permissive for Next.js
    response.headers.set('Content-Security-Policy', 
      "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; media-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; manifest-src 'self'"
    );
  } else {
    // production CSP temporarily disabled
    // response.headers.set('Content-Security-Policy', '...');
  }
  
  // other security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  
  // hsts header
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  // permissions policy
  response.headers.set('Permissions-Policy', 
    'accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), camera=(), display-capture=(), document-domain=(), execution-while-not-rendered=(), execution-while-out-of-viewport=(), fullscreen=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), usb=(), wake-lock=(), xr-spatial-tracking=()'
  );
  
  return response;
}

export const config = {
  matcher: [
    '/api/note/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}; 