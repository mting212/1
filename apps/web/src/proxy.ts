import { auth } from "@/auth"

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isAppRoute = req.nextUrl.pathname.startsWith("/app")

  if (isAppRoute && !isLoggedIn) {
    const signInUrl = new URL("/login", req.url)
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname)
    return Response.redirect(signInUrl)
  }
})

export const config = {
  matcher: ["/app/:path*"],
}
