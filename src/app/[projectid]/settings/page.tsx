import OrganizationSettings from "@/components/projects/OrganizationSettings";

export default function SettingsPage({ params }: { params: { projectId: string } }) {
  return (
    <OrganizationSettings 
      projectId={params.projectId}
      organizationName="Your Organization Name" // Fetch from DB
    />
  )
}