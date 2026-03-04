import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher(["/app(.*)"]);
const isProtectedApiRoute = createRouteMatcher(["/api/topics(.*)", "/api/personas(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req) || isProtectedApiRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    // Match all routes except _next, static files, and /api/cron
    "/((?!_next|api/cron|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
