import { CrmDashboardLoader } from "@/components/crm-dashboard-loader"

export const dynamic = "force-dynamic"

export default async function PublicCrmPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const tab = Array.isArray(params?.tab) ? params?.tab[0] : params?.tab
  return <CrmDashboardLoader initialTab={tab} publicDemo />
}
