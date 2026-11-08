import { ComponentRef, useCallback, useEffect, useRef, useState } from 'react';
import { GestureResponderEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GameView } from '../application/views';
import { UseCases } from '../compositionRoot';
import { COLORS, Code, Color } from '../domain/color';
import { Point } from '../domain/point';
import { Feedback, FeedbackLegend } from './Feedback';
import { Guardian } from './Guardian';
import { LifeBar } from './LifeBar';
import { CooldownBar } from './CooldownBar';
import { ShieldLanes } from './ShieldLanes';
import { ITEM_ICONS, ItemSprite } from './ItemSprite';
import { GiftKind, Item } from '../domain/items';
import { DustPuff } from './DustPuff';
import { FallingMeatball } from './FallingMeatball';
import { Peg } from './Peg';
import { SecretPeg } from './SecretPeg';
import { THEME } from './theme';

type Draft = readonly (Color | undefined)[];

const EMPTY_DRAFT: Draft = [undefined, undefined, undefined, undefined];
const PEEK_SHOWN_MS = 400;
const CAUGHT_SHOWN_MS = 1500;
const TICK_MS = 100;
const MIDDLE_LANE = 1;
const LANE_COUNT_SHOWN = 3;
const ATTACK_RESULT_SHOWN_MS = 1200;
const ITEM_NOTE_SHOWN_MS = 1500;
const SMOKE_SHOWN_MS = 4000; // the smoke's length in the rules (4 s): the response does not carry it

const GIFT_NOTES: Readonly<Record<GiftKind, string>> = {
  food: 'Yum! +3 life',
  smoke: 'Smoke bomb! The guardian is blind',
  xray: 'X-ray! A peg is revealed',
  hourglass: '+30 seconds',
  charm: 'Shield charm: the next meatball is blocked',
};
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

function countdown(timeLeftMs: number): string {
  const seconds = Math.ceil(timeLeftMs / MS_PER_SECOND);
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  return `${minutes}:${String(seconds % SECONDS_PER_MINUTE).padStart(2, '0')}`;
}

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
  const [cooldown, setCooldown] = useState({ startedAt: 0, cooldownMs: 0 });
  const [timeLeftMs, setTimeLeftMs] = useState<number | undefined>(undefined);
  const [shieldLane, setShieldLane] = useState(MIDDLE_LANE);
  const [warning, setWarning] = useState<{ readonly lane: number; readonly landsAt: number; readonly fallMs: number } | undefined>();
  const [attackResult, setAttackResult] = useState<'hit' | 'blocked' | undefined>();
  const [ground, setGround] = useState<{ readonly x: number; readonly y: number; readonly width: number }>();
  const [item, setItem] = useState<Item | undefined>();
  const [itemNote, setItemNote] = useState<string | undefined>();
  const [blind, setBlind] = useState(false);
  const [charmed, setCharmed] = useState(false);

  useEffect(() => {
    if (itemNote === undefined) return undefined;
    const timer = setTimeout(() => setItemNote(undefined), ITEM_NOTE_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [itemNote]);

  useEffect(() => {
    if (!blind) return undefined;
    const timer = setTimeout(() => setBlind(false), SMOKE_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [blind]);

  const collect = (shown: Item) => {
    const response = useCases.collectItem.execute({ id: shown.id });
    setItem(undefined);
    if (response.kind !== 'collected') return;
    const received = response.gift ?? (response.item === 'present' ? undefined : response.item);
    if (received === undefined) return;
    setView(response.view);
    setItemNote(`${response.gift ? `${ITEM_ICONS.present} → ` : ''}${ITEM_ICONS[received]} ${GIFT_NOTES[received]}`);
    if (received === 'smoke') setBlind(true);
    if (received === 'charm') setCharmed(true);
  };
  const warningRef = useRef<{ readonly lane: number; readonly landsAt: number; readonly fallMs: number } | undefined>(undefined);
  const showWarning = (next: { readonly lane: number; readonly landsAt: number; readonly fallMs: number } | undefined) => {
    warningRef.current = next;
    setWarning(next);
  };

  const moveShield = useCallback(
    (lane: number) => {
      const response = useCases.moveShield.execute({ lane });
      if (response.kind === 'moved') setShieldLane(response.lane);
    },
    [useCases],
  );

  useEffect(() => moveShield(MIDDLE_LANE), [moveShield]);

  useEffect(() => {
    if (attackResult === undefined) return undefined;
    const timer = setTimeout(() => setAttackResult(undefined), ATTACK_RESULT_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [attackResult]);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = setInterval(() => {
      const response = useCases.tick.execute();
      if (response.kind !== 'ticked') return;
      setTimeLeftMs(response.timeLeftMs);
      if (response.landed !== undefined) {
        setAttackResult(response.landed);
        setCharmed(false);
        showWarning(undefined);
      }
      if (response.attack !== undefined) {
        showWarning({
          lane: response.attack.lane,
          landsAt: Date.now() + response.attack.landsInMs,
          fallMs: response.attack.landsInMs,
        });
      }
      setItem(response.item);
      setView(response.view);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [playing, useCases]);
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
    if (response.kind === 'revealed' || response.kind === 'caught') {
      setCooldown({ startedAt: Date.now(), cooldownMs: response.cooldownMs });
    }
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
    const fresh = useCases.startGame.execute();
    setView(fresh);
    setDraft(EMPTY_DRAFT);
    setCooldown({ startedAt: 0, cooldownMs: 0 });
    setTimeLeftMs(undefined);
    showWarning(undefined);
    setAttackResult(undefined);
    setItem(undefined);
    setBlind(false);
    setCharmed(false);
    moveShield(MIDDLE_LANE);
  };

  return (
    <Pressable testID="scene" style={styles.screen} onPress={pointAt}>
      <Text style={styles.title}>Yolognese</Text>
      <View ref={guardianRef} onLayout={measureGuardian}>
        <Guardian gaze={gaze} />
        {blind && (
          <Text testID="smoke" accessibilityLabel="guardian blinded by smoke" style={styles.smoke}>
            💨💨
          </Text>
        )}
      </View>
      <View style={styles.row} testID="secret">
        {(view.secret ?? EMPTY_DRAFT).map((color, slot) => {
          const xrayed = view.revealed.find((peg) => peg.index === slot)?.color;
          const shown = view.secret === undefined && peeked?.index === slot ? peeked.color : (color ?? xrayed);
          return (
            <SecretPeg key={slot} testID={`secret-${slot}`} color={shown} onPress={playing ? () => peek(slot) : undefined} />
          );
        })}
      </View>
      <Text testID="status" style={[styles.status, caught && styles.caught]}>
        {caught ? 'Caught peeking! −2 life' : timeLeftMs === 0 && view.status === 'lost' ? "Time's up! The guardian wins." : STATUS_TEXT[view.status]}
      </Text>
      <Text testID="timer" accessibilityLabel="time left" style={styles.timer}>
        ⏱️ {timeLeftMs === undefined ? "–:––" : countdown(timeLeftMs)}
      </Text>
      {playing && <CooldownBar startedAt={cooldown.startedAt} cooldownMs={cooldown.cooldownMs} />}
      <FeedbackLegend />
      {playing && (
        <>
          <Text testID="attack-result" style={styles.attackResult}>
            {attackResult === 'hit' ? '💥 Hit by a meatball! −2 life' : attackResult === 'blocked' ? '🛡️ Blocked!' : warning ? '⚠️ Incoming meatball!' : ' '}
          </Text>
          <Text testID="item-note" style={styles.itemNote}>
            {itemNote ?? (charmed ? '🍀 Shield charm ready' : ' ')}
          </Text>
        </>
      )}
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
      {playing && item !== undefined && <ItemSprite item={item} onCollect={() => collect(item)} />}
      <View style={styles.playerZone} testID="player-zone">
        {playing && (
          <ShieldLanes shieldLane={shieldLane} warningLane={warning?.lane} onMove={moveShield} onMeasured={setGround} />
        )}
        <LifeBar life={view.life} maxLife={view.maxLife} />
      </View>
      {playing && warning !== undefined && ground !== undefined && (
        <FallingMeatball
          from={guardianCentre.current}
          to={{ x: ground.x + ((warning.lane + 0.5) * ground.width) / LANE_COUNT_SHOWN, y: ground.y }}
          durationMs={warning.fallMs}
        />
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
  smoke: { position: 'absolute', alignSelf: 'center', top: 20, fontSize: 40 },
  itemNote: { color: THEME.ink, fontWeight: 'bold', minHeight: 20 },
  playerZone: { alignSelf: 'stretch', alignItems: 'center', marginTop: 4 },
  attackResult: { color: THEME.sauce, fontWeight: 'bold', minHeight: 20 },
  timer: { color: THEME.ink, fontSize: 16, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
