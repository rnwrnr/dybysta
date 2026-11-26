import { Suspense } from "react";
import { ForgotPasswordForm } from "@/components/auth/password-reset";
import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getServerT();
  return { title: t("Forgot password?") };
}

export default function Page() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
