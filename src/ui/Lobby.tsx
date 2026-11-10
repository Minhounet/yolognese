import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { GameView } from '../application/views';
import { UseCases } from '../compositionRoot';
import { RaceEvent } from '../domain/race';
import { Member, SupabaseRaceRoom } from '../infrastructure/SupabaseRaceRoom';
import { GameScreen, RaceProps } from './GameScreen';
import { THEME } from './theme';

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;
const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';

const randomCode = () => Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join('');

type Status = 'form' | 'connecting' | 'joined' | 'failed';

/**
 * Race lobby: pick a name and a room code (share it with friends), see who is in
 * the room; the first one in is the host and starts the race for everyone.
 */
export function Lobby({ useCases, onBack }: { readonly useCases: UseCases; readonly onBack: () => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState(randomCode);
  const [status, setStatus] = useState<Status>('form');
  const [members, setMembers] = useState<readonly Member[]>([]);
  const [room, setRoom] = useState<SupabaseRaceRoom | undefined>();
  const [game, setGame] = useState<{ readonly view: GameView; readonly race: number } | undefined>();
  const races = useRef(0);
  const play = (view: GameView) => setGame({ view, race: ++races.current });
  const toGame = useRef<((event: RaceEvent) => void) | undefined>(undefined);
  const raceUseCases = useMemo(() => (room ? useCases.race(room) : undefined), [room, useCases]);

  useEffect(() => () => room?.leave(), [room]);

  const begin = useCallback(
    (event: Extract<RaceEvent, { type: 'start' }>, joined: SupabaseRaceRoom) => {
      if (!event.players.some(({ id }) => id === joined.me.id)) return; // started without us
      const { view } = useCases.race(joined).startRace.execute({ me: joined.me.id, players: event.players, secret: event.secret });
      play(view);
    },
    [useCases],
  );

  const join = () => {
    const joined = new SupabaseRaceRoom(code.trim().toUpperCase(), name.trim() || 'Player', {
      onMembers: setMembers,
      onStatus: setStatus,
      onEvent: (event) => (event.type === 'start' ? begin(event, joined) : toGame.current?.(event)),
    });
    setRoom(joined);
  };

  const leave = () => {
    room?.leave();
    setRoom(undefined);
    setMembers([]);
    setStatus('form');
  };

  const isHost = room !== undefined && members[0]?.id === room.me.id;

  const start = () => {
    if (room === undefined || raceUseCases === undefined) return;
    const players = members.slice(0, MAX_PLAYERS).map(({ id, name: playerName }) => ({ id, name: playerName }));
    const { view, secret } = raceUseCases.startRace.execute({ me: room.me.id, players });
    room.send({ type: 'start', secret, players });
    play(view);
  };

  const race: RaceProps | undefined = useMemo(
    () =>
      raceUseCases && {
        useCases: raceUseCases,
        subscribe: (onEvent) => {
          toGame.current = onEvent;
          return () => {
            if (toGame.current === onEvent) toGame.current = undefined;
          };
        },
      },
    [raceUseCases],
  );

  if (game !== undefined && race !== undefined) {
    return <GameScreen key={game.race} useCases={useCases} initialView={game.view} race={race} onBack={() => setGame(undefined)} />;
  }

  return (
    <View style={styles.screen}>
      <Pressable testID="back" accessibilityRole="button" onPress={room ? leave : onBack} style={styles.back}>
        <Text style={styles.backText}>{room ? '‹ Leave the room' : '‹ Menu'}</Text>
      </Pressable>
      <Text style={styles.title}>Race</Text>
      <Text style={styles.text}>Same secret for everyone. First to crack it wins; the last one still in wins too. Grab 😈 to throw something at a rival.</Text>
      {room === undefined ? (
        <>
          <Text style={styles.label}>Your name</Text>
          <TextInput testID="name" value={name} onChangeText={setName} placeholder="Ann" maxLength={12} style={styles.input} />
          <Text style={styles.label}>Room code (share it, or type a friend's)</Text>
          <TextInput
            testID="code"
            value={code}
            onChangeText={(text) => setCode(text.toUpperCase())}
            autoCapitalize="characters"
            maxLength={6}
            style={[styles.input, styles.code]}
          />
          <Pressable testID="join" accessibilityRole="button" onPress={join} disabled={code.trim().length < 3} style={styles.button}>
            <Text style={styles.buttonText}>Join the room</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text testID="room" style={styles.roomCode}>
            Room {code}
          </Text>
          <Text testID="room-status" style={styles.text}>
            {status === 'connecting' ? 'Connecting…' : status === 'failed' ? 'Could not reach the room. Check the connection.' : `${members.length} in the room`}
          </Text>
          {members.map((member, index) => (
            <Text key={member.id} testID={`member-${member.name}`} style={styles.member}>
              {index === 0 ? '👑 ' : '🍝 '}
              {member.name}
              {member.id === room.me.id ? ' (you)' : ''}
            </Text>
          ))}
          {isHost ? (
            <Pressable
              testID="start-race"
              accessibilityRole="button"
              onPress={start}
              disabled={members.length < MIN_PLAYERS}
              style={[styles.button, members.length < MIN_PLAYERS && styles.disabled]}
            >
              <Text style={styles.buttonText}>{members.length < MIN_PLAYERS ? 'Waiting for a rival…' : 'Start the race'}</Text>
            </Pressable>
          ) : (
            status === 'joined' && <Text style={styles.text}>Waiting for {members[0]?.name ?? 'the host'} to start…</Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: THEME.background, alignItems: 'center', paddingTop: 48, paddingHorizontal: 24 },
  back: { position: 'absolute', top: 36, left: 12, padding: 8 },
  backText: { color: THEME.sauce, fontSize: 15, fontWeight: 'bold' },
  title: { fontSize: 28, fontWeight: 'bold', color: THEME.sauce, marginTop: 16, marginBottom: 8 },
  text: { color: THEME.ink, fontSize: 15, textAlign: 'center', marginVertical: 6 },
  label: { alignSelf: 'stretch', color: THEME.ink, fontWeight: 'bold', marginTop: 16, marginBottom: 4 },
  input: { alignSelf: 'stretch', backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: THEME.board, padding: 12, fontSize: 18, color: THEME.ink },
  code: { letterSpacing: 6, fontWeight: 'bold', textAlign: 'center' },
  roomCode: { fontSize: 32, fontWeight: 'bold', letterSpacing: 6, color: THEME.ink, marginTop: 16 },
  member: { fontSize: 18, color: THEME.ink, marginVertical: 3 },
  button: { backgroundColor: THEME.sauce, borderRadius: 24, paddingHorizontal: 32, paddingVertical: 12, marginTop: 20 },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
