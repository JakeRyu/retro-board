import { RetroApp } from "../../_components/RetroApp";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RetroApp boardId={id} />;
}
