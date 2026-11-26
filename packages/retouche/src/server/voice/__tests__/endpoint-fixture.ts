import { once } from "node:events";
import { createServer, type IncomingMessage } from "node:http";

import { z } from "zod";

import type { AgentFeedback } from "../analysis/analysis-output";

export interface ReceivedRequest {
  body: Buffer;
  headers: IncomingMessage["headers"];
  path: string;
}

export interface EndpointAnswer {
  body: object;
  status: number;
}

export interface FakeEndpoint {
  baseUrl: string;
  close: () => Promise<void>;
  dropped: Promise<boolean>;
  received: ReceivedRequest[];
}

const addressSchema = z.object({ port: z.number() });

async function bodyOf(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(z.instanceof(Buffer).parse(chunk));
  }
  return Buffer.concat(chunks);
}

export async function startEndpoint(
  answer: EndpointAnswer | null
): Promise<FakeEndpoint> {
  const received: ReceivedRequest[] = [];
  const dropped = Promise.withResolvers<boolean>();
  const server = createServer((request, response) => {
    request.socket.once("close", () => {
      dropped.resolve(true);
    });
    void bodyOf(request).then((body) => {
      received.push({
        body,
        headers: request.headers,
        path: request.url ?? "",
      });
      if (answer === null) {
        return;
      }
      response.writeHead(answer.status, { "content-type": "application/json" });
      response.end(JSON.stringify(answer.body));
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = addressSchema.parse(server.address());
  return {
    baseUrl: `http://127.0.0.1:${port}/v1`,
    close: async () => {
      server.closeAllConnections();
      server.close();
      await once(server, "close");
    },
    dropped: dropped.promise,
    received,
  };
}

export async function formOf(request: ReceivedRequest): Promise<FormData> {
  return await new Request("http://endpoint.test", {
    body: new Uint8Array(request.body),
    headers: { "content-type": request.headers["content-type"] ?? "" },
    method: "POST",
  }).formData();
}

export function chatAnswer(feedback: AgentFeedback): EndpointAnswer {
  return {
    body: {
      choices: [
        {
          finish_reason: "stop",
          index: 0,
          message: { content: JSON.stringify(feedback), role: "assistant" },
        },
      ],
      id: "chatcmpl-1",
      object: "chat.completion",
    },
    status: 200,
  };
}
