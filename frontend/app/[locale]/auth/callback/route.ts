import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  // Derive locale from the request URL (e.g. /en/auth/callback → "en")
  const pathname = request.nextUrl.pathname;
  const locale = pathname.split("/")[1] ?? "en";

  // ── OAuth provider error (e.g. user denied permission) ──────────────────
  // Supabase sends ?error=access_denied&error_description=... in this case.
  const oauthError = searchParams.get("error");
  if (oauthError) {
    const desc = searchParams.get("error_description") ?? oauthError;
    const errorRedirect = new URL(`${origin}/${locale}/auth`);
    errorRedirect.searchParams.set("error", "oauth_error");
    errorRedirect.searchParams.set("error_description", desc);
    return NextResponse.redirect(errorRedirect.toString());
  }

  if (code) {
    const redirectUrl = `${origin}/${locale}${next}`;

    // Build the redirect response first so we can attach cookies to it
    const response = NextResponse.redirect(redirectUrl);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            // Write session cookies onto the redirect response
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return response;
    }
  }

  // On failure, redirect to auth page with error flag (locale-aware)
  return NextResponse.redirect(`${origin}/${locale}/auth?error=oauth_error`);
}