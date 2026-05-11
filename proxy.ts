export { auth as proxy } from "@/lib/auth";

export const config = {
  // Exclude /api so route handlers own their own auth (401 JSON) instead of
  // being redirected to the sign-in page by the proxy.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
