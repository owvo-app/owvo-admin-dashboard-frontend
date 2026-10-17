import BookingDetailContent from "@/components/bookings/BookingDetailContent";

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BookingDetailContent bookingId={id} />;
}
