import { NextResponse } from "next/server";
import { z } from "zod";
import { getDefaultUser, prisma } from "@/lib/db/prisma";
import { serializeTodo } from "@/lib/state/serializers";

const TodoSchema = z.object({
  emailId: z.string().optional().nullable(),
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  createdFromAi: z.boolean().optional()
});

export async function GET() {
  const user = await getDefaultUser();
  const todos = await prisma.todo.findMany({
    where: { userId: user.id },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }]
  });

  return NextResponse.json(todos.map(serializeTodo));
}

export async function POST(request: Request) {
  const user = await getDefaultUser();
  const input = TodoSchema.parse(await request.json());

  let title = input.title;
  let description = input.description ?? null;
  let dueDate = input.dueDate ? new Date(input.dueDate) : null;
  let createdFromAi = input.createdFromAi ?? false;

  if (input.emailId && !title) {
    const analysis = await prisma.emailAnalysis.findFirstOrThrow({
      where: {
        emailId: input.emailId,
        email: { account: { userId: user.id } }
      }
    });

    title = analysis.todoTitle ?? analysis.suggestedAction ?? "Follow up";
    description = analysis.todoReason ?? analysis.summary;
    dueDate = analysis.todoDueDate;
    createdFromAi = true;
  }

  let todo = await prisma.todo.create({
    data: {
      userId: user.id,
      emailId: input.emailId ?? null,
      title: title ?? "Follow up",
      description,
      dueDate,
      createdFromAi
    }
  });

  // Automatically sync to Todoist if key is present
  if (user.settings?.todoistKey) {
    try {
      const response = await fetch("https://api.todoist.com/api/v1/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.settings.todoistKey}`
        },
        body: JSON.stringify({
          content: todo.title,
          description: todo.description ?? "",
          due_string: todo.dueDate ? new Date(todo.dueDate).toISOString().split('T')[0] : undefined
        })
      });

      if (response.ok) {
        const data = await response.json();
        const taskUrl = data.url ?? `https://app.todoist.com/app/task/${data.id}`;
        
        todo = await prisma.todo.update({
          where: { id: todo.id },
          data: {
            todoistId: data.id,
            todoistUrl: taskUrl
          }
        });
      } else {
        console.error("Auto-sync to Todoist failed:", await response.text());
      }
    } catch (e) {
      console.error("Auto-sync to Todoist exception:", e);
    }
  }

  return NextResponse.json(serializeTodo(todo), { status: 201 });
}
