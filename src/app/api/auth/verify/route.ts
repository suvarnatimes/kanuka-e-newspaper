import { NextRequest, NextResponse } from 'next/server';

export function GET(request: NextRequest) {
  const token = request.cookies.get('admin_token');
  if (token && token.value === 'authenticated') {
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
