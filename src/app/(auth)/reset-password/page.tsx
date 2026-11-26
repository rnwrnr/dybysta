import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/password-reset";
import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getServerT();
  return { title: t("Set a new password") };
}

export default function Page() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
