import { ComponentRef, useCallback, useEffect, useRef, useState } from 'react';
import { GestureResponderEvent, LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActionResponse } from '../application/RoundAction';
import { GameView } from '../application/views';
import { UseCases } from '../compositionRoot';
import { COLORS, Color } from '../domain/color';
import { isComplete } from '../domain/draft';
import { Point } from '../domain/point';
import { NoticeKind } from '../domain/round';
import { Arena } from './Arena';
import { DustPuff } from './DustPuff';
import { Feedback, FeedbackLegend } from './Feedback';
import { Guardian } from './Guardian';
import { HeaderBars } from './HeaderBars';
import { Items } from './Items';
import { Peg } from './Peg';
import { Rivals } from './Rivals';
import { StealBanner } from './StealBanner';
import { SecretPeg } from './SecretPeg';
import { THEME } from './theme';

const HIDDEN_ROW = [undefined, undefined, undefined, undefined] as const;
const PEEK_SHOWN_MS = 400;
const CAUGHT_SHOWN_MS = 1500;
const TICK_MS = 100;

const STATUS_TEXT: Readonly<Record<GameView['status'], string>> = {
  playing: 'Crack the secret sauce!',
  won: 'You cracked it! 🍝',
  lost: 'Out of life. The guardian wins.',
};

const TIME_UP = "Time's up! The guardian wins.";

const NOTICE_TEXT: Readonly<Record<NoticeKind, string>> = {
  food: '🍝 Yum! +3 life',
  smoke: '💨 Smoke bomb! The guardian is blind: peek freely',
  xray: '👓 X-ray: one peg, quick!',
  hourglass: '⏳ +30 seconds',
  charm: '🧿 Charm: the next attack is blocked',
  mixup: '🌀 Bad present! Two of your pegs switched places',
  chili: '🌶️ Bad present! Too hot: −2 life',
  hit: '🧆 Ouch! −2 life',
  blocked: '🛡️ Blocked!',
  stolen: '🍴 The fork stole one of your pegs!',
  'grab-missed': '🍴 The fork found nothing to steal',
  sabotage: '😈 Sabotage sent to a rival!',
  beaten: 'Too slow!',
  'last-standing': 'Everyone else is out!',
  switch: '🔀 Switch! New target',
  robbed: '😱 Your sauce was stolen! You got a new one',
  'knocked-out': '💫 Knocked out! −1 point, life refilled',
  scored: '🍝 You stole the sauce! +1',
};

/** A match with friends: send this player's events, and hear the room's changes to the game. */
export interface RaceProps {
  readonly flush: () => Promise<void>;
  readonly subscribe: (onView: (view: GameView) => void) => () => void;
}

interface GameScreenProps {
  readonly useCases: UseCases;
  /** The view to begin with (a race already started); otherwise a solo game starts. */
  readonly initialView?: GameView;
  readonly race?: RaceProps;
  /** Back to the menu (solo) or to the room (race). */
  readonly onBack?: () => void;
}

/** Starts a solo game when no view is given, then shows the board. */
export function GameScreen(props: GameScreenProps) {
  const { useCases, initialView } = props;
  const [first, setFirst] = useState<GameView | undefined>(initialView);

  useEffect(() => {
    if (initialView === undefined) void useCases.startGame.execute().then(setFirst);
  }, [initialView, useCases]);

  if (first === undefined) return <View style={styles.screen} />;
  return <Board {...props} initialView={first} />;
}

function Board({ useCases, initialView, race, onBack }: GameScreenProps & { readonly initialView: GameView }) {
  const [view, setView] = useState<GameView>(initialView);
  const playing = view.status === 'playing';
  const [gaze, setGaze] = useState<Point | undefined>(undefined);
  const guardianCentre = useRef<Point>({ x: 0, y: 0 });
  const guardianRef = useRef<ComponentRef<typeof View>>(null);
  const remainingMs = useRef(0);
  const [peeked, setPeeked] = useState<{ readonly index: number; readonly color: Color } | undefined>();
  const [caught, setCaught] = useState(false);
  const [puffs, setPuffs] = useState<readonly { readonly id: number; readonly at: Point }[]>([]);
  const nextPuff = useRef(0);
  const [scene, setScene] = useState({ width: 0, height: 0 });

  const flush = useCallback(() => void race?.flush(), [race]);

  const show = useCallback(
    async (pending: Promise<ActionResponse>) => {
      const response = await pending;
      if (response.kind === 'done') setView(response.view);
      flush();
    },
    [flush],
  );

  useEffect(() => race?.subscribe(setView), [race]);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = setInterval(() => void show(useCases.tick.execute()), TICK_MS);
    return () => clearInterval(timer);
  }, [playing, show, useCases]);

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

  const peek = async (index: number) => {
    const response = await useCases.peekSecret.execute({ index });
    if (response.kind === 'revealed') {
      setView(response.view);
      setPeeked({ index, color: response.color });
    }
    if (response.kind === 'caught') {
      setView(response.view);
      setCaught(true);
    }
    flush();
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

  const distractTowards = async (target: Point) => {
    const response = await useCases.distractGuardian.execute({ target });
    if (response.kind !== 'distracted') return;
    remainingMs.current = response.view.remainingMs;
    setGaze({ ...response.view.gaze });
  };

  const pointAt = (event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;
    const id = nextPuff.current++;
    setPuffs((current) => [...current, { id, at: { x: pageX, y: pageY } }]);
    void distractTowards({ x: pageX - guardianCentre.current.x, y: pageY - guardianCentre.current.y });
  };

  const removePuff = useCallback((id: number) => setPuffs((current) => current.filter((puff) => puff.id !== id)), []);

  const submit = async () => {
    const { draft } = view;
    if (!isComplete(draft)) return;
    const response = await useCases.submitGuess.execute({ guess: draft });
    if (response.kind === 'played') setView(response.view);
    flush();
  };

  const newGame = async () => {
    setView(await useCases.startGame.execute());
    setGaze(undefined);
  };

  const measureScene = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setScene({ width, height });
  };

  const shownAt = (slot: number): Color | undefined => {
    if (view.secret !== undefined) return view.secret[slot];
    if (peeked?.index === slot) return peeked.color;
    return view.xray?.index === slot ? view.xray.color : undefined;
  };

  const statusText = (): string => {
    if (caught) return 'Caught peeking! −2 life';
    if (view.attack?.fromName !== undefined && playing) return `😈 ${view.attack.fromName} threw a ${view.attack.kind} at you!`;
    if (view.notice !== undefined && playing) return NOTICE_TEXT[view.notice];
    if (view.steal?.finished) {
      const [top] = view.steal.scores;
      return view.status === 'won' ? `Match over! 🏆 You win with ${top.points}` : `Match over: ${top.name} wins with ${top.points}`;
    }
    if (view.steal?.waiting) return '🍝 Sauce stolen! Waiting for the switch…';
    if (view.lostBy === 'beaten') return `${view.race?.beatenBy ?? 'A rival'} cracked it first!`;
    if (view.lastStanding) return 'Everyone else is out. You win! 🏆';
    if (view.lostBy === 'time') return TIME_UP;
    return STATUS_TEXT[view.status];
  };
  const alarming = caught || view.notice === 'robbed' || view.notice === 'knocked-out' || view.notice === 'hit' || view.notice === 'stolen' || view.notice === 'mixup' || view.notice === 'chili';

  return (
    <Pressable testID="scene" style={styles.screen} onPress={pointAt} onLayout={measureScene}>
      <View style={styles.titleLine}>
        {onBack !== undefined && (
          <Pressable testID="back" accessibilityRole="button" onPress={onBack} style={styles.back}>
            <Text style={styles.backText}>{race ? '‹ Room' : '‹ Menu'}</Text>
          </Pressable>
        )}
        <Text style={styles.title}>Yolognese</Text>
      </View>
      {view.race !== undefined && <Rivals rivals={view.race.rivals} />}
      {view.steal !== undefined && <StealBanner steal={view.steal} />}
      <HeaderBars life={view.life} maxLife={view.maxLife} timeLeftMs={view.timeLeftMs} cooldownMs={view.cooldownMs} />
      <View ref={guardianRef} onLayout={measureGuardian}>
        <Guardian gaze={gaze} blind={view.blindMs > 0} angry={view.attack !== undefined} />
      </View>
      <View style={styles.row} testID="secret">
        {HIDDEN_ROW.map((_, slot) => (
          <SecretPeg key={slot} testID={`secret-${slot}`} color={shownAt(slot)} onPress={playing ? () => void peek(slot) : undefined} />
        ))}
      </View>
      <Text testID="status" style={[styles.status, alarming && styles.alarm]}>
        {statusText()}
      </Text>
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
            {view.draft.map((color, slot) => (
              <Peg key={slot} testID={`slot-${slot}`} color={color} onPress={() => void show(useCases.editDraft.execute({ kind: 'clear', slot }))} />
            ))}
            <Pressable
              testID="submit"
              accessibilityRole="button"
              disabled={!isComplete(view.draft)}
              onPress={() => void submit()}
              style={[styles.button, !isComplete(view.draft) && styles.disabled]}
            >
              <Text style={styles.buttonText}>Guess</Text>
            </Pressable>
          </View>
          <View style={styles.row}>
            {COLORS.map((color) => (
              <Peg
                key={color}
                testID={`palette-${color}`}
                color={color}
                size={44}
                onPress={() => void show(useCases.editDraft.execute({ kind: 'place', color }))}
              />
            ))}
          </View>
          <Arena
            shieldLane={view.shieldLane}
            attack={view.attack}
            charm={view.charm}
            onMove={(lane) => void show(useCases.moveShield.execute({ lane }))}
          />
        </View>
      ) : (
        <Pressable
          testID="new-game"
          accessibilityRole="button"
          onPress={race && onBack ? onBack : () => void newGame()}
          style={[styles.button, styles.newGame]}
        >
          <Text style={styles.buttonText}>{race ? 'Back to the room' : 'New game'}</Text>
        </Pressable>
      )}
      <Items items={view.items} width={scene.width} height={scene.height} onCollect={(id) => void show(useCases.collectItem.execute({ id }))} />
      {puffs.map((puff) => (
        <DustPuff key={puff.id} at={puff.at} onDone={() => removePuff(puff.id)} />
      ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: THEME.background, alignItems: 'center', paddingTop: 32, paddingBottom: 16 },
  titleLine: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: 20, fontWeight: 'bold', color: THEME.sauce },
  back: { position: 'absolute', left: 12, paddingVertical: 4, paddingHorizontal: 8 },
  backText: { color: THEME.sauce, fontSize: 15, fontWeight: 'bold' },
  status: { color: THEME.ink, fontSize: 15, marginVertical: 6, marginHorizontal: 16, textAlign: 'center' },
  board: { flex: 1, alignSelf: 'stretch', marginHorizontal: 16, backgroundColor: THEME.board, borderRadius: 12 },
  boardContent: { alignItems: 'center', paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center' },
  controls: { alignItems: 'center', alignSelf: 'stretch', marginTop: 6 },
  button: { backgroundColor: THEME.sauce, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 10, marginLeft: 8 },
  newGame: { marginTop: 8, marginLeft: 0, paddingHorizontal: 32 },
  disabled: { opacity: 0.4 },
  alarm: { color: THEME.sauce, fontWeight: 'bold' },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
});
