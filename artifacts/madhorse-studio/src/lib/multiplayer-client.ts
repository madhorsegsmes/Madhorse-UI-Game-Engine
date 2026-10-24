import {
  CreateMultiplayerSessionBody,
  CreateMultiplayerSessionResponse,
  GetMultiplayerSessionStateResponse,
  JoinMultiplayerSessionBody,
  JoinMultiplayerSessionResponse,
  SendMultiplayerGameEventBody,
  SendMultiplayerGameEventResponse,
  SyncMultiplayerSessionStateBody,
  SyncMultiplayerSessionStateResponse,
  type MultiplayerGameEvent,
  type MultiplayerSessionMember,
  type MultiplayerSessionState,
  type MultiplayerStateUpdate,
} from "@workspace/api-zod";

export type MultiplayerRoomMember = MultiplayerSessionMember;
export type MultiplayerRoomSnapshot = MultiplayerSessionState;
export type MultiplayerRoomUpdate = MultiplayerStateUpdate;

async function requestJson<T>(
  path: string,
  schema: { parse: (value: unknown) => T },
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    let message = `Multiplayer request failed (${response.status}).`;
    try {
      const error = await response.json() as { error?: string };
      if (error.error) message = error.error;
    } catch {
      // Keep the status-based message when the server did not return JSON.
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return schema.parse(await response.json());
}

export function createMultiplayerRoom(playerName: string): Promise<MultiplayerRoomMember> {
  const body = CreateMultiplayerSessionBody.parse({ playerName });
  return requestJson("/multiplayer/sessions", CreateMultiplayerSessionResponse, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function joinMultiplayerRoom(code: string, playerName: string): Promise<MultiplayerRoomMember> {
  const normalizedCode = code.trim().toUpperCase();
  const body = JoinMultiplayerSessionBody.parse({ playerName });
  return requestJson(
    `/multiplayer/sessions/${encodeURIComponent(normalizedCode)}/join`,
    JoinMultiplayerSessionResponse,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function getMultiplayerRoomState(
  member: MultiplayerRoomMember,
): Promise<MultiplayerRoomSnapshot> {
  return requestJson(
    `/multiplayer/sessions/${encodeURIComponent(member.code)}/state`,
    GetMultiplayerSessionStateResponse,
    { method: "GET" },
    member.token,
  );
}

export function syncMultiplayerRoomState(
  member: MultiplayerRoomMember,
  update: MultiplayerRoomUpdate,
): Promise<MultiplayerRoomSnapshot> {
  const body = SyncMultiplayerSessionStateBody.parse(update);
  return requestJson(
    `/multiplayer/sessions/${encodeURIComponent(member.code)}/state`,
    SyncMultiplayerSessionStateResponse,
    { method: "PUT", body: JSON.stringify(body) },
    member.token,
  );
}

export function sendMultiplayerGameEvent(
  member: MultiplayerRoomMember,
  name: string,
  payload: string,
): Promise<MultiplayerGameEvent> {
  const body = SendMultiplayerGameEventBody.parse({ name, payload });
  return requestJson(
    `/multiplayer/sessions/${encodeURIComponent(member.code)}/events`,
    SendMultiplayerGameEventResponse,
    { method: "POST", body: JSON.stringify(body) },
    member.token,
  );
}

export async function leaveMultiplayerRoom(member: MultiplayerRoomMember): Promise<void> {
  await requestJson(
    `/multiplayer/sessions/${encodeURIComponent(member.code)}/leave`,
    { parse: () => undefined },
    { method: "POST" },
    member.token,
  );
}
