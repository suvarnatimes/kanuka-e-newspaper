import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // If the user is trying to access the upload API without a token, block them
  if (request.nextUrl.pathname.startsWith('/api/upload')) {
    const token = request.cookies.get('admin_token');
    
    if (!token || token.value !== 'authenticated') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/upload'],
};
