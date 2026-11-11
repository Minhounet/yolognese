import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { GameView } from '../application/views';
import { UseCases } from '../compositionRoot';
import { COLORS, Code } from '../domain/color';
import { RoomEvent } from '../domain/steal';
import { Member, Mode, SupabaseRaceRoom } from '../infrastructure/SupabaseRaceRoom';
import { GameScreen, RaceProps } from './GameScreen';
import { SaucePicker } from './SaucePicker';
import { THEME } from './theme';

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;
const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';

const randomCode = () => Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join('');
const randomSecret = (): Code => [0, 1, 2, 3].map(() => COLORS[Math.floor(Math.random() * COLORS.length)]) as unknown as Code;

const MODES: Readonly<Record<Mode, { readonly title: string; readonly rules: string }>> = {
  steal: {
    title: '🕵️ Steal the sauce',
    rules: 'Everyone hides a secret and cracks someone else’s. The target switches every 45 s and after each crack. +1 per sauce stolen; most points in 5 minutes wins.',
  },
  race: {
    title: '🏁 Race',
    rules: 'Same secret for everyone. First to crack it wins; the last one still in wins too.',
  },
};

type Status = 'form' | 'connecting' | 'joined' | 'failed';
type StartEvent = Extract<RoomEvent, { type: 'start' }>;

/**
 * The room: pick a name and a room code (share it with friends), see who is in
 * it. The first one in is the host: picks the mode and starts for everyone.
 */
export function Lobby({ useCases, onBack }: { readonly useCases: UseCases; readonly onBack: () => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState(randomCode);
  const [secret, setSecret] = useState<Code>(randomSecret);
  const secretRef = useRef(secret);
  secretRef.current = secret;
  const [status, setStatus] = useState<Status>('form');
  const [members, setMembers] = useState<readonly Member[]>([]);
  const [room, setRoom] = useState<SupabaseRaceRoom | undefined>();
  const [game, setGame] = useState<{ readonly view: GameView; readonly match: number } | undefined>();
  const matches = useRef(0);
  const toGame = useRef<((event: RoomEvent) => void) | undefined>(undefined);
  const raceUseCases = useMemo(() => (room ? useCases.race(room) : undefined), [room, useCases]);

  useEffect(() => () => room?.leave(), [room]);

  const play = useCallback((view: GameView) => setGame({ view, match: ++matches.current }), []);

  const begin = useCallback(
    (event: StartEvent, joined: SupabaseRaceRoom) => {
      if (!event.players.some(({ id }) => id === joined.me.id)) return; // started without us
      const cases = useCases.race(joined);
      if (event.mode === 'steal') {
        // This phone owns its sauce: the host may have started with an older one (presence lags).
        const mine = secretRef.current;
        const players = event.players.map((player) => ({
          ...player,
          secret: player.id === joined.me.id ? mine : (player.secret ?? randomSecret()),
        }));
        play(cases.startSteal.execute({ me: joined.me.id, players }));
        const told = event.players.find(({ id }) => id === joined.me.id)?.secret;
        if (told === undefined || told.join() !== mine.join()) joined.send({ type: 'new-secret', from: joined.me.id, secret: mine });
      } else if (event.secret !== undefined) {
        play(cases.startRace.execute({ me: joined.me.id, players: event.players, secret: event.secret }).view);
      }
    },
    [useCases, play],
  );

  const join = () => {
    const joined = new SupabaseRaceRoom(
      code.trim().toUpperCase(),
      { name: name.trim() || 'Player', secret, mode: 'steal' },
      {
        onMembers: setMembers,
        onStatus: setStatus,
        onEvent: (event) => (event.type === 'start' ? begin(event, joined) : toGame.current?.(event)),
      },
    );
    setRoom(joined);
  };

  const leave = () => {
    room?.leave();
    setRoom(undefined);
    setMembers([]);
    setStatus('form');
  };

  const changeSecret = (changed: Code) => {
    setSecret(changed);
    room?.update({ secret: changed });
  };

  const host = members[0];
  const isHost = room !== undefined && host?.id === room.me.id;
  const mode: Mode = host?.mode ?? 'steal';

  const pickMode = (picked: Mode) => {
    room?.update({ mode: picked });
  };

  const start = () => {
    if (room === undefined || raceUseCases === undefined) return;
    const seated = members.slice(0, MAX_PLAYERS);
    if (mode === 'steal') {
      const players = seated.map((member) => ({ id: member.id, name: member.name, secret: member.secret ?? randomSecret() }));
      room.send({ type: 'start', mode: 'steal', players });
      play(raceUseCases.startSteal.execute({ me: room.me.id, players }));
      return;
    }
    const players = seated.map(({ id, name: playerName }) => ({ id, name: playerName }));
    const started = raceUseCases.startRace.execute({ me: room.me.id, players });
    room.send({ type: 'start', mode: 'race', secret: started.secret, players });
    play(started.view);
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
    return <GameScreen key={game.match} useCases={useCases} initialView={game.view} race={race} onBack={() => setGame(undefined)} />;
  }

  return (
    <View style={styles.screen}>
      <Pressable testID="back" accessibilityRole="button" onPress={room ? leave : onBack} style={styles.back}>
        <Text style={styles.backText}>{room ? '‹ Leave the room' : '‹ Menu'}</Text>
      </Pressable>
      <Text style={styles.title}>Play friends</Text>
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
          <View style={styles.members}>
            {members.map((member, index) => (
              <Text key={member.id} testID={`member-${member.name}`} style={styles.member}>
                {index === 0 ? '👑 ' : '🍝 '}
                {member.name}
                {member.id === room.me.id ? ' (you)' : ''}
              </Text>
            ))}
          </View>
          <View style={styles.modes}>
            {(Object.keys(MODES) as Mode[]).map((option) => (
              <Pressable
                key={option}
                testID={`mode-${option}`}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === option }}
                disabled={!isHost}
                onPress={() => pickMode(option)}
                style={[styles.mode, mode === option && styles.modePicked]}
              >
                <Text style={[styles.modeText, mode === option && styles.modeTextPicked]}>{MODES[option].title}</Text>
              </Pressable>
            ))}
          </View>
          <Text testID="mode-rules" style={styles.rules}>
            {MODES[mode].rules}
          </Text>
          {mode === 'steal' && <SaucePicker secret={secret} onChange={changeSecret} />}
          {isHost ? (
            <Pressable
              testID="start-race"
              accessibilityRole="button"
              onPress={start}
              disabled={members.length < MIN_PLAYERS}
              style={[styles.button, members.length < MIN_PLAYERS && styles.disabled]}
            >
              <Text style={styles.buttonText}>{members.length < MIN_PLAYERS ? 'Waiting for a rival…' : 'Start'}</Text>
            </Pressable>
          ) : (
            status === 'joined' && <Text style={styles.text}>Waiting for {host?.name ?? 'the host'} to start…</Text>
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
  text: { color: THEME.ink, fontSize: 15, textAlign: 'center', marginVertical: 4 },
  rules: { color: THEME.ink, fontSize: 14, textAlign: 'center', marginTop: 6 },
  label: { alignSelf: 'stretch', color: THEME.ink, fontWeight: 'bold', marginTop: 16, marginBottom: 4 },
  input: { alignSelf: 'stretch', backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: THEME.board, padding: 12, fontSize: 18, color: THEME.ink },
  code: { letterSpacing: 6, fontWeight: 'bold', textAlign: 'center' },
  roomCode: { fontSize: 32, fontWeight: 'bold', letterSpacing: 6, color: THEME.ink, marginTop: 8 },
  members: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  member: { fontSize: 17, color: THEME.ink, margin: 4 },
  modes: { flexDirection: 'row', marginTop: 12 },
  mode: { borderRadius: 18, borderWidth: 2, borderColor: THEME.sauce, paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 4 },
  modePicked: { backgroundColor: THEME.sauce },
  modeText: { color: THEME.sauce, fontWeight: 'bold' },
  modeTextPicked: { color: '#fff' },
  button: { backgroundColor: THEME.sauce, borderRadius: 24, paddingHorizontal: 32, paddingVertical: 12, marginTop: 16 },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
