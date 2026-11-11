import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MatchMode } from '../application/ports';
import { LobbyView, RoomPlay } from '../application/RoomPlay';
import { GameView } from '../application/views';
import { UseCases } from '../compositionRoot';
import { GameScreen, RaceProps } from './GameScreen';
import { SaucePicker } from './SaucePicker';
import { THEME } from './theme';

const MODES: Readonly<Record<MatchMode, { readonly title: string; readonly rules: string }>> = {
  steal: {
    title: '🕵️ Steal the sauce',
    rules: 'Everyone hides a secret and cracks someone else’s. The target switches every 45 s and after each crack. +1 per sauce stolen; most points in 5 minutes wins.',
  },
  race: {
    title: '🏁 Race',
    rules: 'Same secret for everyone. First to crack it wins; the last one still in wins too.',
  },
};

/**
 * The room screen: name and room code, then who is in the room, the mode, this
 * player's sauce and the host's start. Everything it does goes through RoomPlay.
 */
export function Lobby({ useCases, onBack }: { readonly useCases: UseCases; readonly onBack: () => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState(() => useCases.joinRoom.suggestCode());
  const [play, setPlay] = useState<RoomPlay | undefined>();
  const [lobby, setLobby] = useState<LobbyView | undefined>();
  const [game, setGame] = useState<{ readonly view: GameView; readonly match: number } | undefined>();
  const matches = useRef(0);
  const toGame = useRef<((view: GameView) => void) | undefined>(undefined);

  useEffect(() => () => play?.leave(), [play]);

  const [joining, setJoining] = useState(false);
  const [failed, setFailed] = useState(false);

  const join = async () => {
    setJoining(true);
    setFailed(false);
    const joined = await useCases.joinRoom
      .execute(
      { code, name },
      {
        onLobby: setLobby,
        onMatch: (view) => setGame({ view, match: ++matches.current }),
        onGame: (view) => toGame.current?.(view),
      },
    )
      .catch(() => undefined);
    setJoining(false);
    if (joined === undefined) {
      setFailed(true);
      return;
    }
    setPlay(joined);
    setLobby(joined.view());
  };

  const leave = () => {
    play?.leave();
    setPlay(undefined);
    setLobby(undefined);
  };

  const race: RaceProps | undefined = useMemo(
    () =>
      play && {
        flush: () => play.flush(),
        subscribe: (onView) => {
          toGame.current = onView;
          return () => {
            if (toGame.current === onView) toGame.current = undefined;
          };
        },
      },
    [play],
  );

  if (game !== undefined && race !== undefined) {
    return <GameScreen key={game.match} useCases={useCases} initialView={game.view} race={race} onBack={() => setGame(undefined)} />;
  }

  return (
    <View style={styles.screen}>
      <Pressable testID="back" accessibilityRole="button" onPress={play ? leave : onBack} style={styles.back}>
        <Text style={styles.backText}>{play ? '‹ Leave the room' : '‹ Menu'}</Text>
      </Pressable>
      <Text style={styles.title}>Play friends</Text>
      {play === undefined || lobby === undefined ? (
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
          <Pressable
            testID="join"
            accessibilityRole="button"
            onPress={() => void join()}
            disabled={joining || code.trim().length < 3}
            style={[styles.button, joining && styles.disabled]}
          >
            <Text style={styles.buttonText}>{joining ? 'Joining…' : 'Join the room'}</Text>
          </Pressable>
          {failed && <Text style={styles.text}>Could not reach the game server. Check the connection and try again.</Text>}
        </>
      ) : (
        <>
          <Text testID="room" style={styles.roomCode}>
            Room {lobby.code}
          </Text>
          <Text testID="room-status" style={styles.text}>
            {lobby.status === 'connecting'
              ? 'Connecting…'
              : lobby.status === 'failed'
                ? 'Could not reach the room. Check the connection.'
                : `${lobby.members.length} in the room`}
          </Text>
          <View style={styles.members}>
            {lobby.members.map((member) => (
              <Text key={member.name + String(member.me)} testID={`member-${member.name}`} style={styles.member}>
                {member.host ? '👑 ' : '🍝 '}
                {member.name}
                {member.me ? ' (you)' : ''}
              </Text>
            ))}
          </View>
          <View style={styles.modes}>
            {(Object.keys(MODES) as MatchMode[]).map((option) => (
              <Pressable
                key={option}
                testID={`mode-${option}`}
                accessibilityRole="button"
                accessibilityState={{ selected: lobby.mode === option }}
                disabled={!lobby.isHost}
                onPress={() => play.pickMode(option)}
                style={[styles.mode, lobby.mode === option && styles.modePicked]}
              >
                <Text style={[styles.modeText, lobby.mode === option && styles.modeTextPicked]}>{MODES[option].title}</Text>
              </Pressable>
            ))}
          </View>
          <Text testID="mode-rules" style={styles.rules}>
            {MODES[lobby.mode].rules}
          </Text>
          {lobby.mode === 'steal' && <SaucePicker secret={lobby.mySauce} onChange={(sauce) => play.changeSauce(sauce)} />}
          {lobby.isHost ? (
            <Pressable
              testID="start-race"
              accessibilityRole="button"
              onPress={() => void play.start()}
              disabled={!lobby.canStart}
              style={[styles.button, !lobby.canStart && styles.disabled]}
            >
              <Text style={styles.buttonText}>{lobby.canStart ? 'Start' : 'Waiting for a rival…'}</Text>
            </Pressable>
          ) : (
            lobby.status === 'joined' && <Text style={styles.text}>Waiting for {lobby.hostName ?? 'the host'} to start…</Text>
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
