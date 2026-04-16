import { notFound } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { getDashboardData, getPatientChart } from "@/lib/chart-service";
import { ChartApp } from "@/components/chart-app";
import { LoginCard } from "@/components/login-card";
import { MfaEnrollmentCard } from "@/components/mfa-enrollment-card";

export default async function HomePage() {
  let session;

  try {
    session = await getSessionContext();
  } catch {
    return <LoginCard />;
  }

  if (session.role === "ADMIN" && !session.mfaEnabled) {
    return <MfaEnrollmentCard professionalName={session.professionalName} />;
  }

  const dashboard = await getDashboardData(session.role);

  if (!dashboard?.patientId) {
    notFound();
  }

  const chart = await getPatientChart(dashboard.patientId, session.role);

  if (!chart) {
    notFound();
  }

  return <ChartApp initialChart={chart} dashboard={dashboard} session={session} />;
}
