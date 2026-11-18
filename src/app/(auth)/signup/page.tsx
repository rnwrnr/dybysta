import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getServerT();
  return { title: t("Create account") };
}
export default function SignupPage() {
  return (
    <Suspense>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
