import { ComponentRef, useCallback, useEffect, useRef, useState } from 'react';
import { GestureResponderEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GameView } from '../application/views';
import { UseCases } from '../compositionRoot';
import { COLORS, Code, Color } from '../domain/color';
import { Point } from '../domain/point';
import { Bar } from './Bar';
import { Feedback, FeedbackLegend } from './Feedback';
import { Guardian } from './Guardian';
import { DustPuff } from './DustPuff';
import { Peg } from './Peg';
import { SecretPeg } from './SecretPeg';
import { THEME } from './theme';

type Draft = readonly (Color | undefined)[];

const EMPTY_DRAFT: Draft = [undefined, undefined, undefined, undefined];
const PEEK_SHOWN_MS = 400;
const CAUGHT_SHOWN_MS = 1500;
const MAX_LIFE = 10;

function isComplete(draft: Draft): draft is Code {
  return draft.every((color) => color !== undefined);
}

function withColor(draft: Draft, color: Color): Draft {
  const slot = draft.indexOf(undefined);
  return slot === -1 ? draft : draft.map((current, index) => (index === slot ? color : current));
}

function withoutSlot(draft: Draft, slot: number): Draft {
  return draft.map((current, index) => (index === slot ? undefined : current));
}

const STATUS_TEXT: Readonly<Record<GameView['status'], string>> = {
  playing: 'Crack the secret sauce!',
  won: 'You cracked it! 🍝',
  lost: 'Out of life. The guardian wins.',
};

export function GameScreen({ useCases }: { readonly useCases: UseCases }) {
  const [view, setView] = useState<GameView>(() => useCases.startGame.execute());
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const playing = view.status === 'playing';
  const [gaze, setGaze] = useState<Point | undefined>(undefined);
  const guardianCentre = useRef<Point>({ x: 0, y: 0 });
  const guardianRef = useRef<ComponentRef<typeof View>>(null);
  const remainingMs = useRef(0);
  const [peeked, setPeeked] = useState<{ readonly index: number; readonly color: Color } | undefined>();
  const [caught, setCaught] = useState(false);
  const [puffs, setPuffs] = useState<readonly { readonly id: number; readonly at: Point }[]>([]);
  const nextPuff = useRef(0);

  useEffect(() => {
    if (gaze === undefined) setPeeked(undefined);
  }, [gaze]);

  useEffect(() => {
    if (peeked === undefined) return undefined;
    const timer = setTimeout(() => setPeeked(undefined), PEEK_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [peeked]);

  useEffect(() => {
    if (!caught) return undefined;
    const timer = setTimeout(() => setCaught(false), CAUGHT_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [caught]);

  const peek = (index: number) => {
    const response = useCases.peekSecret.execute({ index });
    if (response.kind === 'revealed') setPeeked({ index, color: response.color });
    if (response.kind === 'caught') {
      setView(response.view);
      setCaught(true);
    }
  };

  useEffect(() => {
    if (gaze === undefined) return undefined;
    const timer = setTimeout(() => setGaze(undefined), remainingMs.current);
    return () => clearTimeout(timer);
  }, [gaze]);

  const measureGuardian = () =>
    guardianRef.current?.measureInWindow((x, y, width, height) => {
      guardianCentre.current = { x: x + width / 2, y: y + height / 2 };
    });

  const distractTowards = (target: Point) => {
    const response = useCases.distractGuardian.execute({ target });
    if (response.kind !== 'distracted') return;
    remainingMs.current = response.view.remainingMs;
    setGaze({ ...response.view.gaze });
  };

  const pointAt = (event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;
    const id = nextPuff.current++;
    setPuffs((current) => [...current, { id, at: { x: pageX, y: pageY } }]);
    distractTowards({ x: pageX - guardianCentre.current.x, y: pageY - guardianCentre.current.y });
  };

  const removePuff = useCallback((id: number) => setPuffs((current) => current.filter((puff) => puff.id !== id)), []);

  const submit = () => {
    if (!isComplete(draft)) return;
    const response = useCases.submitGuess.execute({ guess: draft });
    if (response.kind === 'played') setView(response.view);
    setDraft(EMPTY_DRAFT);
  };

  const newGame = () => {
    setView(useCases.startGame.execute());
    setDraft(EMPTY_DRAFT);
  };

  return (
    <Pressable testID="scene" style={styles.screen} onPress={pointAt}>
      <Text style={styles.title}>Yolognese</Text>
      <View ref={guardianRef} onLayout={measureGuardian}>
        <Guardian gaze={gaze} />
      </View>
      <View style={styles.row} testID="secret">
        {(view.secret ?? EMPTY_DRAFT).map((color, slot) => {
          const shown = view.secret === undefined && peeked?.index === slot ? peeked.color : color;
          return (
            <SecretPeg key={slot} testID={`secret-${slot}`} color={shown} onPress={playing ? () => peek(slot) : undefined} />
          );
        })}
      </View>
      <Text testID="status" style={[styles.status, caught && styles.caught]}>
        {caught ? 'Caught peeking! −2 ❤️' : STATUS_TEXT[view.status]}
      </Text>
      <Bar testID="life" icon="❤️" value={view.life} max={MAX_LIFE} color={THEME.sauce} label={`life ${view.life} of ${MAX_LIFE}`} />
      <FeedbackLegend />
      <ScrollView style={styles.board} contentContainerStyle={styles.boardContent}>
        {view.turns.map((turn, index) => (
          <View key={index} style={styles.row} testID={`turn-${index}`}>
            {turn.guess.map((color, slot) => (
              <Peg key={slot} color={color} size={30} />
            ))}
            <Feedback testID={`feedback-${index}`} exact={turn.exact} misplaced={turn.misplaced} />
          </View>
        ))}
      </ScrollView>
      {playing ? (
        <View style={styles.controls}>
          <View style={styles.row}>
            {draft.map((color, slot) => (
              <Peg key={slot} testID={`slot-${slot}`} color={color} onPress={() => setDraft(withoutSlot(draft, slot))} />
            ))}
          </View>
          <View style={styles.row}>
            {COLORS.map((color) => (
              <Peg key={color} testID={`palette-${color}`} color={color} size={44} onPress={() => setDraft(withColor(draft, color))} />
            ))}
          </View>
          <Pressable
            testID="submit"
            accessibilityRole="button"
            disabled={!isComplete(draft)}
            onPress={submit}
            style={[styles.button, !isComplete(draft) && styles.disabled]}
          >
            <Text style={styles.buttonText}>Guess</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable testID="new-game" accessibilityRole="button" onPress={newGame} style={styles.button}>
          <Text style={styles.buttonText}>New game</Text>
        </Pressable>
      )}
      {puffs.map((puff) => (
        <DustPuff key={puff.id} at={puff.at} onDone={() => removePuff(puff.id)} />
      ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: THEME.background, alignItems: 'center', paddingTop: 36, paddingBottom: 24 },
  title: { fontSize: 24, fontWeight: 'bold', color: THEME.sauce, marginBottom: 8 },
  status: { color: THEME.ink, fontSize: 16, marginVertical: 8 },
  board: { flex: 1, alignSelf: 'stretch', marginHorizontal: 16, backgroundColor: THEME.board, borderRadius: 12 },
  boardContent: { alignItems: 'center', paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center' },
  controls: { alignItems: 'center', marginTop: 8 },
  button: { backgroundColor: THEME.sauce, borderRadius: 24, paddingHorizontal: 32, paddingVertical: 12, marginTop: 8 },
  disabled: { opacity: 0.4 },
  caught: { color: THEME.sauce, fontWeight: 'bold' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
