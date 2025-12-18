import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const next = searchParams.get("next") ?? "/"

  try {
    const supabase = createRouteHandlerClient({ cookies })
    const code = searchParams.get('code')
    if (!code) {
      return NextResponse.redirect(`${origin}/auth/auth-code-error`)
    }
    await supabase.auth.exchangeCodeForSession(code)
    return NextResponse.redirect(`${origin}${next}`)
  } catch {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
  }
}
