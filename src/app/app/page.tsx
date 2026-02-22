import { redirect } from "next/navigation";

export default async function AppRootPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; banner?: string }>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  if (params.error) qs.set("error", params.error);
  if (params.message) qs.set("message", params.message);
  if (params.banner) qs.set("banner", params.banner);
  const query = qs.toString();
  redirect("/app/articles" + (query ? "?" + query : ""));
}
