import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { refreshAccessToken } from '@/lib/calendar/google'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL('/login?error=access_denied', request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', request.url))
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`
    )

    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(new URL('/login?error=no_tokens', request.url))
    }

    // Get user info from Google
    oauth2Client.setCredentials(tokens)
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const { data: userInfo } = await oauth2.userinfo.get()

    if (!userInfo.email) {
      return NextResponse.redirect(new URL('/login?error=no_email', request.url))
    }

    const supabase = await createClient()

    // Check if user exists, if not create account
    const { data: existingUser } = await supabase.auth.getUser()

    if (!existingUser.user) {
      // Sign up or sign in with Google
      const { data: authData, error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`,
        },
      })

      if (authError) {
        // If OAuth sign-in fails, try to create user with email/password
        // For now, we'll store the tokens and let the user complete registration
        return NextResponse.redirect(
          new URL(`/signup?email=${encodeURIComponent(userInfo.email)}`, request.url)
        )
      }
    }

    // Store calendar tokens in user profile
    const serviceClient = await createServiceClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      await serviceClient
        .from('users')
        .update({
          calendar_provider: 'google',
          calendar_access_token: tokens.access_token,
          calendar_refresh_token: tokens.refresh_token,
        })
        .eq('id', user.id)
    }

    return NextResponse.redirect(new URL('/', request.url))
  } catch (error) {
    console.error('Google OAuth callback error:', error)
    return NextResponse.redirect(new URL('/login?error=oauth_error', request.url))
  }
}
