import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-3 py-6 [--clerk-modal-max-height:min(90vh,640px)]">
      <SignIn
        afterSignInUrl="/app/articles"
        fallbackRedirectUrl="/app/articles"
      />
    </div>
  );
}
