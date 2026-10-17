import WasherDetailContent from "@/components/washers/WasherDetailContent";

export default async function WasherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WasherDetailContent washerId={id} />;
}
