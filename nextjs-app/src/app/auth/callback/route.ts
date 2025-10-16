import { createServerClient } from '@supabase/ssr'
import type { VerifyOtpParams } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  ROLE_DEFAULT_REDIRECT,
  type MemberSummary,
  normaliseRole,
  isAllowedRedirect,
} from '@/lib/auth/roleRouting'

function createRedirectResponse(url: URL) {
  return NextResponse.redirect(url)
}

const isSafeRelativePath = (path: string | null): path is string => {
  if (!path) {
    return false
  }

  return path.startsWith('/') && !path.startsWith('//') && !path.includes('://')
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const redirectTo = requestUrl.searchParams.get('redirectTo') ?? '/home'
  const redirectUrl = new URL(redirectTo, requestUrl.origin)
  const loginUrl = new URL('/login', requestUrl.origin)
  const cookieStore = await cookies()

  const code = requestUrl.searchParams.get('code')
  const token_hash = requestUrl.searchParams.get('token_hash')
  const token = requestUrl.searchParams.get('token')
  const typeParam = (requestUrl.searchParams.get('type') ?? 'magiclink') as VerifyOtpParams['type']
  const access_token = requestUrl.searchParams.get('access_token')
  const refresh_token = requestUrl.searchParams.get('refresh_token')

  const handleAuthError = (reason: string, message?: string) => {
    const errorUrl = new URL(loginUrl)
    errorUrl.searchParams.set('error', reason)
    if (message) {
      errorUrl.searchParams.set('message', message)
    }
    const redirectParam = requestUrl.searchParams.get('redirectTo')
    if (redirectParam) {
      errorUrl.searchParams.set('redirectTo', redirectParam)
    }
    return NextResponse.redirect(errorUrl)
  }

  if (code || (token_hash && typeParam) || (token && typeParam) || (access_token && refresh_token)) {
    const response = createRedirectResponse(redirectUrl)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    let error: { message: string } | null = null

    if (code) {
      const result = await supabase.auth.exchangeCodeForSession(code)
      error = result.error
    } else if (token_hash || token) {
      const verifyParams: VerifyOtpParams = token_hash
        ? ({ token_hash, type: typeParam } as VerifyOtpParams)
        : ({ token: token!, type: typeParam } as VerifyOtpParams)

      const result = await supabase.auth.verifyOtp(verifyParams)
      error = result.error
    } else if (access_token && refresh_token) {
      const result = await supabase.auth.setSession({
        access_token,
        refresh_token,
      })
      error = result.error
    }

    if (error) {
      return handleAuthError('callback_failed', error.message)
    }

    const { data: { user } } = await supabase.auth.getUser()

    let member: MemberSummary | null = null
    if (user) {
      const { data } = await supabase
        .from('members')
        .select('role, email')
        .eq('user_id', user.id)
        .single<MemberSummary>()
      member = data ?? null
    }

    const effectiveRole = normaliseRole(member)
    const requestedRedirect = isSafeRelativePath(redirectTo)
      ? redirectTo
      : null

    const finalRedirect = requestedRedirect && isAllowedRedirect(requestedRedirect, effectiveRole)
      ? requestedRedirect
      : ROLE_DEFAULT_REDIRECT[effectiveRole]

    response.headers.set('Location', new URL(finalRedirect, requestUrl.origin).toString())

    return response
  }

  const safeRedirect = JSON.stringify(redirectTo)
  const callbackPath = JSON.stringify(requestUrl.pathname)

  return new NextResponse(
    `<!DOCTYPE html>
    <html lang="cs">
      <head>
        <meta charset="utf-8" />
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <title>Přihlašování...</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #1d4f7d 0%, #049edb 100%);
            color: white;
          }
          .container {
            text-align: center;
          }
          .spinner {
            border: 4px solid rgba(255, 255, 255, 0.3);
            border-top: 4px solid white;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="spinner"></div>
          <h2>Přihlašuji vás do aplikace...</h2>
          <p>Prosím čekejte</p>
        </div>
        <script>
          (function () {
            var redirectTo = ${safeRedirect};
            var callbackPath = ${callbackPath};
            if (window.location.hash) {
              var hashParams = new URLSearchParams(window.location.hash.substring(1));
              var accessToken = hashParams.get('access_token');
              var refreshToken = hashParams.get('refresh_token');
              var type = hashParams.get('type') || 'magiclink';
              if (accessToken && refreshToken) {
                var query = new URLSearchParams({
                  access_token: accessToken,
                  refresh_token: refreshToken,
                  type: type,
                  redirectTo: redirectTo,
                });
                window.location.replace(callbackPath + '?' + query.toString());
                return;
              }
            }
            var loginUrl = new URL('/login', window.location.origin);
            loginUrl.searchParams.set('error', 'no_token');
            loginUrl.searchParams.set('redirectTo', redirectTo);
            window.location.replace(loginUrl.toString());
          })();
        </script>
      </body>
    </html>`,
    {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Language': 'cs',
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  )
}
