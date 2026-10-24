import { randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateMultiplayerSessionBody,
  CreateMultiplayerSessionResponse,
  GetMultiplayerSessionStateParams,
  GetMultiplayerSessionStateResponse,
  JoinMultiplayerSessionBody,
  JoinMultiplayerSessionParams,
  JoinMultiplayerSessionResponse,
  LeaveMultiplayerSessionParams,
  SendMultiplayerGameEventBody,
  SendMultiplayerGameEventParams,
  SendMultiplayerGameEventResponse,
  SyncMultiplayerSessionStateBody,
  SyncMultiplayerSessionStateParams,
  SyncMultiplayerSessionStateResponse,
  type MultiplayerGameEvent,
  type MultiplayerObjectState,
  type MultiplayerSessionState,
  type MultiplayerTransform,
} from "@workspace/api-zod";

const router: IRouter = Router();
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_ROOM_PLAYERS = 8;
const MEMBER_IDLE_MS = 20_000;
const ROOM_IDLE_MS = 60 * 60_000;

type Member = {
  id: string;
  name: string;
  token: string;
  isHost: boolean;
  transform: MultiplayerTransform | null;
  lastSeen: number;
};

type Room = {
  code: string;
  members: Map<string, Member>;
  objects: Map<string, MultiplayerObjectState>;
  events: MultiplayerGameEvent[];
  nextSequence: number;
  lastActivity: number;
};

const rooms = new Map<string, Room>();

function makeCode(): string {
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

function pruneRooms(now = Date.now()): void {
  for (const [code, room] of rooms) {
    if (now - room.lastActivity > ROOM_IDLE_MS) {
      rooms.delete(code);
      continue;
    }
    for (const [id, member] of room.members) {
      if (now - member.lastSeen > MEMBER_IDLE_MS) room.members.delete(id);
    }
    if (room.members.size === 0) {
      rooms.delete(code);
      continue;
    }
    if (![...room.members.values()].some(member => member.isHost)) {
      const firstMember = room.members.values().next().value as Member | undefined;
      if (firstMember) firstMember.isHost = true;
    }
  }
}

function buildState(room: Room): MultiplayerSessionState {
  return {
    code: room.code,
    players: [...room.members.values()].map(member => ({
      id: member.id,
      name: member.name,
      isHost: member.isHost,
      transform: member.transform,
    })),
    objects: [...room.objects.values()],
    events: room.events.slice(-50),
  };
}

function getPathCode(req: Request, res: Response): string | null {
  const rawCode = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
  const code = typeof rawCode === "string" ? rawCode.toUpperCase() : "";
  const parsed = GetMultiplayerSessionStateParams.safeParse({ code });
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid six-character room code." });
    return null;
  }
  return parsed.data.code;
}

function authorize(
  req: Request,
  res: Response,
  code: string,
): { room: Room; member: Member } | null {
  pruneRooms();
  const room = rooms.get(code);
  if (!room) {
    res.status(404).json({ error: "This room has ended or does not exist." });
    return null;
  }
  const header = req.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const member = [...room.members.values()].find(candidate => {
    const supplied = Buffer.from(token);
    const stored = Buffer.from(candidate.token);
    return supplied.length === stored.length && timingSafeEqual(supplied, stored);
  });
  if (!member) {
    res.status(401).json({ error: "This room membership is no longer valid." });
    return null;
  }
  member.lastSeen = Date.now();
  room.lastActivity = member.lastSeen;
  return { room, member };
}

function createMember(name: string, isHost: boolean): Member {
  return {
    id: randomUUID(),
    name: name.trim().slice(0, 32),
    token: randomBytes(32).toString("base64url"),
    isHost,
    transform: null,
    lastSeen: Date.now(),
  };
}

function membership(room: Room, member: Member) {
  return CreateMultiplayerSessionResponse.parse({
    code: room.code,
    playerId: member.id,
    token: member.token,
    playerName: member.name,
    isHost: member.isHost,
  });
}

router.post("/multiplayer/sessions", (req, res): void => {
  pruneRooms();
  const parsed = CreateMultiplayerSessionBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.playerName.trim()) {
    res.status(400).json({ error: "Enter a player name." });
    return;
  }
  let code = makeCode();
  while (rooms.has(code)) code = makeCode();
  const room: Room = {
    code,
    members: new Map(),
    objects: new Map(),
    events: [],
    nextSequence: 1,
    lastActivity: Date.now(),
  };
  const host = createMember(parsed.data.playerName, true);
  room.members.set(host.id, host);
  rooms.set(code, room);
  res.status(201).json(membership(room, host));
});

router.post("/multiplayer/sessions/:code/join", (req, res): void => {
  pruneRooms();
  const rawCode = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
  const params = JoinMultiplayerSessionParams.safeParse({
    code: typeof rawCode === "string" ? rawCode.toUpperCase() : "",
  });
  const body = JoinMultiplayerSessionBody.safeParse(req.body);
  if (!params.success || !body.success || !body.data.playerName.trim()) {
    res.status(400).json({ error: "Check the room code and player name." });
    return;
  }
  const room = rooms.get(params.data.code);
  if (!room || room.members.size >= MAX_ROOM_PLAYERS) {
    res.status(404).json({ error: "Room not found or already full." });
    return;
  }
  const player = createMember(body.data.playerName, false);
  room.members.set(player.id, player);
  room.lastActivity = Date.now();
  res.json(JoinMultiplayerSessionResponse.parse(membership(room, player)));
});

router.get("/multiplayer/sessions/:code/state", (req, res): void => {
  const code = getPathCode(req, res);
  if (!code) return;
  const access = authorize(req, res, code);
  if (!access) return;
  res.json(GetMultiplayerSessionStateResponse.parse(buildState(access.room)));
});

router.put("/multiplayer/sessions/:code/state", (req, res): void => {
  const code = getPathCode(req, res);
  if (!code) return;
  const access = authorize(req, res, code);
  if (!access) return;
  const parsed = SyncMultiplayerSessionStateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "The multiplayer state update is invalid." });
    return;
  }
  if (access.member.isHost) {
    const ids = new Set([...access.room.objects.keys(), ...parsed.data.objects.map(object => object.entityId)]);
    if (ids.size > 256) {
      res.status(400).json({ error: "A room supports up to 256 synchronized objects." });
      return;
    }
    for (const object of parsed.data.objects) access.room.objects.set(object.entityId, object);
  }
  access.member.transform = parsed.data.playerTransform;
  res.json(SyncMultiplayerSessionStateResponse.parse(buildState(access.room)));
});

router.post("/multiplayer/sessions/:code/events", (req, res): void => {
  const code = getPathCode(req, res);
  if (!code) return;
  const access = authorize(req, res, code);
  if (!access) return;
  const parsed = SendMultiplayerGameEventBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.name.trim()) {
    res.status(400).json({ error: "Enter a short event name." });
    return;
  }
  const event = SendMultiplayerGameEventResponse.parse({
    sequence: access.room.nextSequence++,
    playerName: access.member.name,
    name: parsed.data.name.trim(),
    payload: (parsed.data.payload ?? "").slice(0, 300),
    sentAt: Date.now(),
  });
  access.room.events.push(event);
  if (access.room.events.length > 50) access.room.events.shift();
  res.status(201).json(event);
});

router.post("/multiplayer/sessions/:code/leave", (req, res): void => {
  const code = getPathCode(req, res);
  if (!code) return;
  const access = authorize(req, res, code);
  if (!access) return;
  const params = LeaveMultiplayerSessionParams.safeParse({ code });
  if (!params.success) {
    res.status(400).json({ error: "Enter a valid room code." });
    return;
  }
  access.room.members.delete(access.member.id);
  if (access.room.members.size === 0) {
    rooms.delete(access.room.code);
  } else if (access.member.isHost) {
    const nextHost = access.room.members.values().next().value as Member | undefined;
    if (nextHost) nextHost.isHost = true;
  }
  res.sendStatus(204);
});

export default router;
