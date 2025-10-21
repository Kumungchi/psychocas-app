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
import { isSafeRelativePath, sanitizeRedirect } from '@/lib/navigation/redirect'
import { resolveLocaleFromHeader } from '@/lib/i18n/detect'
import { getDictionary } from '@/lib/i18n/strings'

function createRedirectResponse(url: URL) {
  return NextResponse.redirect(url)
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const redirectParam = requestUrl.searchParams.get('redirectTo')
  const sanitizedRedirect = sanitizeRedirect(redirectParam)
  const redirectUrl = new URL(sanitizedRedirect, requestUrl.origin)
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
    if (redirectParam) {
      errorUrl.searchParams.set('redirectTo', sanitizedRedirect)
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

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError) {
      return handleAuthError('callback_failed', sessionError.message)
    }

    const user = session?.user ?? null

    let member: MemberSummary | null = null
    if (user) {
      const { error: ensureError } = await supabase.rpc('ensure_membership')
      if (ensureError) {
        console.warn('ensure_membership RPC failed', ensureError)
      }

      const { data } = await supabase
        .from('memberships')
        .select('role, email')
        .eq('user_id', user.id)
        .single<MemberSummary>()
      member = data ?? null
    }

    const effectiveRole = normaliseRole(member)
    const requestedRedirect = redirectParam && isSafeRelativePath(redirectParam)
      ? redirectParam
      : null

    const finalRedirect = requestedRedirect && isAllowedRedirect(requestedRedirect, effectiveRole)
      ? requestedRedirect
      : ROLE_DEFAULT_REDIRECT[effectiveRole]

    response.headers.set('Location', new URL(finalRedirect, requestUrl.origin).toString())

    return response
  }

  const safeRedirect = JSON.stringify(sanitizedRedirect)
  const callbackPath = JSON.stringify(requestUrl.pathname)

  const locale = resolveLocaleFromHeader(request.headers.get('accept-language'))
  const dictionary = getDictionary(locale)
  const callbackSection = (dictionary as Record<string, unknown>).callback
  const fallbackSection =
    callbackSection && typeof callbackSection === 'object'
      ? (callbackSection as Record<string, unknown>).fallback
      : undefined
  const fallbackCopy =
    fallbackSection && typeof fallbackSection === 'object'
      ? (fallbackSection as { title?: unknown; heading?: unknown; wait?: unknown })
      : {}

  const title = typeof fallbackCopy.title === 'string' ? fallbackCopy.title : 'Přihlašování...'
  const heading = typeof fallbackCopy.heading === 'string' ? fallbackCopy.heading : 'Přihlašuji vás do aplikace...'
  const wait = typeof fallbackCopy.wait === 'string' ? fallbackCopy.wait : 'Prosím čekejte'

  return new NextResponse(
    `<!DOCTYPE html>
    <html lang="${locale}">
      <head>
        <meta charset="utf-8" />
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <title>${title}</title>
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
          <h2>${heading}</h2>
          <p>${wait}</p>
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
        'Content-Language': locale,
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  )
}
