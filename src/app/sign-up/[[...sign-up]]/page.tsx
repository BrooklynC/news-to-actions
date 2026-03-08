import { cookies } from "next/headers";
import { SignUp } from "@clerk/nextjs";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ admin?: string }>;
}) {
  const params = await searchParams;
  if (params.admin === "1") {
    (await cookies()).set("signup_as_admin", "1", {
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6">
      {params.admin === "1" && (
        <p className="text-sm font-medium text-amber-700 dark:text-amber-200">
          Signing up as admin — you will have full access to Actions and Admin.
        </p>
      )}
      <SignUp
        afterSignUpUrl="/app/articles"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/app/articles"
      />
      <a
        href={params.admin === "1" ? "/sign-up" : "/sign-up?admin=1"}
        className="text-sm text-zinc-500 underline hover:no-underline dark:text-zinc-400"
      >
        {params.admin === "1"
          ? "Sign up as regular member instead"
          : "Sign up as admin instead"}
      </a>
    </div>
  );
}
