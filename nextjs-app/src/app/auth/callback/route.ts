import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')

  // If we have token_hash, verify it
  if (token_hash && type) {
    const cookieStore = await cookies()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as any,
    })

    if (!error) {
      return NextResponse.redirect(new URL('/home', request.url))
    }
    
    return NextResponse.redirect(new URL('/login?error=verification_failed', request.url))
  }

  // If no token_hash, return page that will handle hash fragment on client side
  return new NextResponse(
    `<!DOCTYPE html>
    <html>
      <head>
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
          // Supabase returns tokens in hash fragment, we need to process them client-side
          if (window.location.hash) {
            // Redirect to home, browser will automatically set the session from hash
            window.location.href = '/home' + window.location.hash;
          } else {
            // No hash means no tokens, redirect to login
            window.location.href = '/login?error=no_token';
          }
        </script>
      </body>
    </html>`,
    {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    }
  )
}
