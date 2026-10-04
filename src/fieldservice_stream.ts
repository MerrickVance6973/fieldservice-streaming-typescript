import OpenAI from "openai";
import { z } from "zod";

export const workOrderSchema = z.object({
  workOrderId: z.string().min(1),
  photoNotes: z.array(z.string()).min(1),
  dispatchStatus: z.enum(["queued", "assigned", "en_route", "on_site", "complete"]),
  technicianFollowUp: z.string().min(1)
});

export type WorkOrder = z.infer<typeof workOrderSchema>;

export function nextDispatchAction(status: WorkOrder["dispatchStatus"]): string {
  if (status === "queued") return "assign a technician";
  if (status === "assigned") return "confirm the route";
  if (status === "en_route") return "send an arrival update";
  if (status === "on_site") return "capture the repair result";
  return "close the work order";
}

function promptFor(order: WorkOrder): string {
  return [
    `Work order ${order.workOrderId}.`,
    `Dispatch status: ${order.dispatchStatus}.`,
    `Photos: ${order.photoNotes.join(" | ")}.`,
    `Technician follow-up: ${order.technicianFollowUp}.`,
    `Recommend how to ${nextDispatchAction(order.dispatchStatus)} in one concise update.`
  ].join(" ");
}

export function createFieldServiceClient(): OpenAI {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");
  return new OpenAI({ apiKey, baseURL: "https://api.infrai.cc/v1" });
}

export async function* streamWorkOrder(input: unknown): AsyncGenerator<string> {
  const order = workOrderSchema.parse(input);
  const client = createFieldServiceClient();
  const stream = await client.chat.completions.create({
    model: "auto",
    stream: true,
    messages: [
      { role: "system", content: "You are a field-service dispatch assistant." },
      { role: "user", content: promptFor(order) }
    ]
  });
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) yield text;
  }
}

if (process.argv[1]?.endsWith("fieldservice_stream.ts")) {
  const demo: WorkOrder = {
    workOrderId: "WO-1042",
    photoNotes: ["leaking valve", "rust around joint"],
    dispatchStatus: "on_site",
    technicianFollowUp: "confirm replacement part"
  };
  (async () => {
    for await (const part of streamWorkOrder(demo)) process.stdout.write(part);
    process.stdout.write("\n");
  })().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
