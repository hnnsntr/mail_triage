import { NextResponse } from "next/server";
import { prisma, getDefaultUser } from "@/lib/db/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getDefaultUser();
    
    if (!user.settings?.todoistKey) {
      return NextResponse.json({ error: "No Todoist API key configured" }, { status: 400 });
    }

    const todo = await prisma.todo.findFirst({
      where: { id: id, userId: user.id }
    });

    if (!todo) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 });
    }

    if (todo.todoistId) {
      return NextResponse.json({ success: true, url: todo.todoistUrl, message: "Already in Todoist" });
    }

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

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: `Todoist API error: ${errorText}` }, { status: response.status });
    }

    const data = await response.json();
    const taskUrl = data.url ?? `https://app.todoist.com/app/task/${data.id}`;

    const updatedTodo = await prisma.todo.update({
      where: { id: todo.id },
      data: {
        todoistId: data.id,
        todoistUrl: taskUrl
      }
    });

    return NextResponse.json({ success: true, url: taskUrl, todo: updatedTodo });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
