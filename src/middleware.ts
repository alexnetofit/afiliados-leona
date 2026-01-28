import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Simplesmente passa a requisição sem fazer nada
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match apenas rotas protegidas - não a página inicial ou auth
    '/dashboard/:path*',
    '/admin/:path*',
    '/links/:path*',
    '/vendas/:path*',
    '/assinaturas/:path*',
    '/perfil/:path*',
  ],
};
