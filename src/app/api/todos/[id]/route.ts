import { NextResponse } from "next/server";
import { z } from "zod";
import { getDefaultUser, prisma } from "@/lib/db/prisma";
import { serializeTodo } from "@/lib/state/serializers";

const UpdateTodoSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  status: z.enum(["open", "done", "ignored"]).optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getDefaultUser();
  const input = UpdateTodoSchema.parse(await request.json());

  const todo = await prisma.todo.update({
    where: {
      id,
      userId: user.id
    },
    data: {
      ...input,
      dueDate: input.dueDate === undefined ? undefined : input.dueDate ? new Date(input.dueDate) : null
    }
  });

  return NextResponse.json(serializeTodo(todo));
}
