import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Protected routes
  const protectedPaths = ['/home', '/redeem', '/validate', '/stats', '/technician']
  const isProtectedRoute = protectedPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  )

  if (isProtectedRoute && !user) {
    // Redirect to login if accessing protected route without authentication
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  if (request.nextUrl.pathname === '/' && user) {
    // Redirect authenticated users from root to home
    return NextResponse.redirect(new URL('/home', request.url))
  }

  if (request.nextUrl.pathname === '/login' && user) {
    // Redirect authenticated users from login to home
    const redirectTo = request.nextUrl.searchParams.get('redirectTo') || '/home'
    return NextResponse.redirect(new URL(redirectTo, request.url))
  }

  // Role-based access control
  if (user && (request.nextUrl.pathname.startsWith('/validate') || 
              request.nextUrl.pathname.startsWith('/stats') ||
              request.nextUrl.pathname.startsWith('/technician'))) {
    
    const { data: member } = await supabase
      .from('members')
      .select('role')
      .eq('user_id', user.id)
      .single()

    // Validate and Stats require manager or council
    if ((request.nextUrl.pathname.startsWith('/validate') || 
         request.nextUrl.pathname.startsWith('/stats')) &&
        member?.role !== 'manager' && member?.role !== 'council') {
      return NextResponse.redirect(new URL('/home?error=unauthorized', request.url))
    }

    // Technician requires technician or council role
    if (request.nextUrl.pathname.startsWith('/technician') && 
        member?.role !== 'technician' && member?.role !== 'council') {
      return NextResponse.redirect(new URL('/home?error=unauthorized', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}