import { redirect } from "next/navigation";
import { BoardClient } from "@/components/board/BoardClient";
import { getBoardWorkspaceForUser, serializeBoard } from "@/lib/board-service";
import { getSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const { board, team } = await getBoardWorkspaceForUser(session.userId);

  return (
    <BoardClient initialBoard={serializeBoard(board)} user={session} team={team} />
  );
}
