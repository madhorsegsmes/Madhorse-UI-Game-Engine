import { useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import {
  createMultiplayerRoom,
  joinMultiplayerRoom,
  leaveMultiplayerRoom,
  sendMultiplayerGameEvent,
  type MultiplayerRoomMember,
  type MultiplayerRoomSnapshot,
} from "@/lib/multiplayer-client";

type Props = {
  objectEventName?: string;
  member: MultiplayerRoomMember | null;
  snapshot: MultiplayerRoomSnapshot | null;
  onMemberChange: (member: MultiplayerRoomMember | null) => void;
  onSnapshotChange: Dispatch<SetStateAction<MultiplayerRoomSnapshot | null>>;
};

export function MultiplayerToolsPanel({ member, snapshot, onMemberChange, onSnapshotChange, objectEventName }: Props) {
  const [playerName, setPlayerName] = useState("Player");
  const [roomCode, setRoomCode] = useState("");
  const [eventName, setEventName] = useState("player.ready");
  const [eventPayload, setEventPayload] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (objectEventName) setEventName(objectEventName);
  }, [objectEventName]);

  useEffect(() => {
    if (member) {
      setRoomCode(member.code);
      setPlayerName(member.playerName);
    }
  }, [member]);

  async function hostRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const room = await createMultiplayerRoom(playerName);
      onMemberChange(room);
      onSnapshotChange(null);
      setRoomCode(room.code);
      setMessage("Room is ready. Share the code with another player.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not host a room.");
    } finally {
      setBusy(false);
    }
  }

  async function joinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const room = await joinMultiplayerRoom(roomCode, playerName);
      onMemberChange(room);
      onSnapshotChange(null);
      setRoomCode(room.code);
      setMessage(`Joined room ${room.code}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not join that room.");
    } finally {
      setBusy(false);
    }
  }

  async function leaveRoom() {
    if (!member) return;
    setBusy(true);
    try {
      await leaveMultiplayerRoom(member);
      onMemberChange(null);
      onSnapshotChange(null);
      setMessage("You left the multiplayer room.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not leave the room.");
    } finally {
      setBusy(false);
    }
  }

  async function sendEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!member) return;
    setBusy(true);
    setMessage("");
    try {
      const sent = await sendMultiplayerGameEvent(member, eventName, eventPayload);
      onSnapshotChange(current => current
        ? { ...current, events: [...current.events.filter(item => item.sequence !== sent.sequence), sent].slice(-50) }
        : current);
      setEventPayload("");
      setMessage(`Sent “${sent.name}” to the room.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send the game event.");
    } finally {
      setBusy(false);
    }
  }

  async function copyRoomCode() {
    if (!member) return;
    try {
      await navigator.clipboard.writeText(member.code);
      setMessage("Room code copied.");
    } catch {
      setMessage(`Share room code ${member.code} with the other player.`);
    }
  }

  const players = snapshot?.players ?? (member ? [{
    id: member.playerId,
    name: member.playerName,
    isHost: member.isHost,
    transform: null,
  }] : []);

  return (
    <section className="fresh-multiplayer-panel" aria-label="Multiplayer rooms" data-testid="multiplayer-room-panel">
      <div className="fresh-multiplayer-heading">
        <div>
          <strong>Play Together</strong>
          <p>Host a room, share its code, and test with friends.</p>
        </div>
        {member && <span className="fresh-multiplayer-live">ROOM LIVE</span>}
      </div>

      {!member ? (
        <div className="fresh-multiplayer-connect">
          <label className="fresh-multiplayer-field">
            <span>Your player name</span>
            <input
              value={playerName}
              maxLength={32}
              onChange={event => setPlayerName(event.currentTarget.value)}
              placeholder="Player"
            />
          </label>
          <div className="fresh-multiplayer-actions">
            <form onSubmit={hostRoom}>
              <button type="submit" disabled={busy || !playerName.trim()} data-testid="multiplayer-host-room">
                Host Room
              </button>
            </form>
            <form onSubmit={joinRoom}>
              <input
                aria-label="Room code"
                value={roomCode}
                maxLength={6}
                onChange={event => setRoomCode(event.currentTarget.value.toUpperCase().replace(/[^A-Z2-9]/g, ""))}
                placeholder="6-letter code"
              />
              <button type="submit" disabled={busy || !playerName.trim() || roomCode.length !== 6} data-testid="multiplayer-join-room">
                Join Room
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="fresh-multiplayer-room">
          <div className="fresh-multiplayer-room-code">
            <div>
              <span>ROOM CODE</span>
              <strong data-testid="multiplayer-room-code">{member.code}</strong>
            </div>
            <button type="button" onClick={copyRoomCode} disabled={busy}>Copy Code</button>
            <button type="button" onClick={leaveRoom} disabled={busy} className="is-quiet">Leave</button>
          </div>
          <div className="fresh-multiplayer-roster">
            <strong>Players ({players.length}/8)</strong>
            {players.map(player => (
              <div key={player.id} className="fresh-multiplayer-player">
                <span>{player.name}{player.id === member.playerId ? " (you)" : ""}</span>
                <small>{player.isHost ? "Host" : "Guest"}</small>
              </div>
            ))}
          </div>
          <form className="fresh-multiplayer-event-form" onSubmit={sendEvent}>
            <strong>Send Game Event</strong>
            <div>
              <input
                aria-label="Event name"
                value={eventName}
                maxLength={80}
                onChange={event => setEventName(event.currentTarget.value)}
                placeholder="event.name"
              />
              <input
                aria-label="Event message"
                value={eventPayload}
                maxLength={300}
                onChange={event => setEventPayload(event.currentTarget.value)}
                placeholder="Optional message"
              />
              <button type="submit" disabled={busy || !eventName.trim()} data-testid="multiplayer-send-event">
                Send
              </button>
            </div>
          </form>
          <div className="fresh-multiplayer-events" aria-label="Recent room events" aria-live="polite">
            <strong>Recent Events</strong>
            {snapshot?.events.length
              ? snapshot.events.slice(-5).reverse().map(item => (
                <p key={item.sequence}><b>{item.playerName}</b> · {item.name}{item.payload ? ` — ${item.payload}` : ""}</p>
              ))
              : <p>No events yet.</p>}
          </div>
        </div>
      )}

      <p className="fresh-multiplayer-note">
        Open the same saved scene on each PC, add Network Player to your player, then press Play Test on both.
        The host controls Sync Object movement. Updates arrive twice per second.
        Rooms support 8 players and reset when the server restarts.
      </p>
      {message && <p className="fresh-multiplayer-status" role="status">{message}</p>}
    </section>
  );
}
