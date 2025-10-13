// middleware.js
import { NextResponse } from 'next/server';

export function middleware(request) {
  // 1. ดึง token จาก cookie ที่ Firebase Client SDK สร้างไว้
  const sessionToken = request.cookies.get('__session'); // ชื่อ cookie อาจแตกต่างกัน ให้ตรวจสอบจาก browser dev tools

  const { pathname } = request.nextUrl;

  // 2. ถ้าจะเข้าหน้า login แต่มี token อยู่แล้ว -> ให้ไป dashboard เลย
  if (sessionToken && pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 3. ถ้าจะเข้าหน้าที่ต้องป้องกัน (เช่น /dashboard) แต่ไม่มี token -> ให้กลับไปหน้า login
  if (!sessionToken && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  // ถ้าเงื่อนไขอื่นๆ ตรงหมด ก็ให้ไปต่อได้
  return NextResponse.next();
}

// Config: ระบุว่า middleware นี้จะทำงานที่ path ไหนบ้าง
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}