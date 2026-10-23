import { client } from "@tier0/sdk";

// Browser caller fixture: no Key, host or tenant configuration is accepted.
export function describeRequest(code: string) {
  return client.streams.requests.use({ code }).describe();
}

export function messageTopic(topic: string) {
  return client.streams.messages.use({ topic });
}
