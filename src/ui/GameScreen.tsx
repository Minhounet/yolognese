import { ComponentRef, useCallback, useEffect, useRef, useState } from 'react';
import { GestureResponderEvent, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GameView } from '../application/views';
import { UseCases } from '../compositionRoot';
import { COLORS, Code, Color } from '../domain/color';
import { Point } from '../domain/point';
import { Feedback, FeedbackLegend } from './Feedback';
import { Guardian } from './Guardian';
import { LifeBar } from './LifeBar';
import { CooldownBar } from './CooldownBar';
import { ShieldLanes } from './ShieldLanes';
import { DraggableColor } from './DraggableColor';
import { ITEM_ICONS, ItemSprite, itemPoint } from './ItemSprite';
import { DarknessVeil, Explosion, SmokeGrenade, XrayBeam } from './Effects';
import { GiftKind, Item, ItemKind } from '../domain/items';
import { DustPuff } from './DustPuff';
import { FallingMeatball } from './FallingMeatball';
import { PunchArm } from './PunchArm';
import { Peg } from './Peg';
import { SecretPeg } from './SecretPeg';
import { THEME } from './theme';

type Draft = readonly (Color | undefined)[];

const EMPTY_DRAFT: Draft = [undefined, undefined, undefined, undefined];
const CAUGHT_SHOWN_MS = 1500;
const TICK_MS = 100;
const MIDDLE_LANE = 1;
const CONTROL_TOUCH_MS = 600;
const DRAGGED_HALF = 22;
const MOST_TURNS_SHOWN = 10;
const TURN_ROW_HEIGHT = 38; // a 30 px peg and its 4 px margins
const BOARD_PADDING = 8;

/** AC30: as many of the latest guesses as the board can show, 10 at most, the oldest dropped first. */
function turnsThatFit(boardHeight: number): number {
  const fits = Math.floor((boardHeight - 2 * BOARD_PADDING) / TURN_ROW_HEIGHT);
  return Math.max(1, Math.min(MOST_TURNS_SHOWN, fits));
}
const PUNCH_RETURN_MS = 300;
const BEAM_SHOWN_MS = 600;
const BLAST_SHOWN_MS = 600;
const SECRET_LENGTH = 4;

const ATTACK_LINES = {
  hit: '💥 Hit by a meatball! −2 life',
  blocked: '🛡️ Blocked!',
  'punch-hit': '👊 Punched! −1 life',
  parried: '🛡️ Parried!',
  boom: '💥 The bomb exploded! −2 life',
  'punch-coming': '👊 The guardian punches!',
  'meatball-coming': '⚠️ Incoming meatball!',
  'fork-coming': '⚠️ Incoming fork! It wants your pegs',
  stolen: '🍴 The fork stole one of your pegs!',
  none: ' ',
} as const;
const LANE_COUNT_SHOWN = 3;
const ATTACK_RESULT_SHOWN_MS = 1200;
const ITEM_NOTE_SHOWN_MS = 1500;
const SMOKE_SHOWN_MS = 4000; // the smoke's length in the rules (4 s): the response does not carry it

const GIFT_NOTES: Readonly<Record<Exclude<ItemKind | GiftKind, 'present'>, string>> = {
  food: 'Yum! +3 life',
  smoke: 'Smoke bomb! The guardian is blind',
  xray: 'X-ray! One peg, quick',
  hourglass: '+30 seconds',
  charm: 'Shield charm: the next meatball is blocked',
  bomb: 'Bomb thrown away!',
  darkness: "Darkness! You can't see",
  mixup: 'Mix-up! Two of your pegs switched places',
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

function laneTarget(ground: { readonly x: number; readonly y: number; readonly width: number }, lane: number): Point {
  return { x: ground.x + ((lane + 0.5) * ground.width) / LANE_COUNT_SHOWN, y: ground.y };
}

const STATUS_TEXT: Readonly<Record<GameView['status'], string>> = {
  playing: 'Crack the secret sauce!',
  won: 'You cracked it! 🍝',
  lost: 'Out of life. The guardian wins.',
};

export function GameScreen({ useCases }: { readonly useCases: UseCases }) {
  const [view, setView] = useState<GameView>(() => useCases.startGame.execute());
  const playing = view.status === 'playing';
  const draft: Draft = view.draft;
  const editDraft = (command: Parameters<UseCases['editDraft']['execute']>[0]) => {
    const response = useCases.editDraft.execute(command);
    if (response.kind === 'edited') setView(response.view);
  };
  const [gaze, setGaze] = useState<Point | undefined>(undefined);
  const guardianCentre = useRef<Point>({ x: 0, y: 0 });
  const guardianRef = useRef<ComponentRef<typeof View>>(null);
  const remainingMs = useRef(0);
  const [peeked, setPeeked] = useState<{ readonly index: number; readonly color: Color } | undefined>();
  const [caught, setCaught] = useState(false);
  const [cooldown, setCooldown] = useState({ startedAt: 0, cooldownMs: 0 });
  const [timeLeftMs, setTimeLeftMs] = useState<number | undefined>(undefined);
  const [shieldLane, setShieldLane] = useState(MIDDLE_LANE);
  const [warning, setWarning] = useState<{ readonly lane: number; readonly landsAt: number; readonly fallMs: number; readonly punch?: boolean; readonly fork?: boolean } | undefined>();
  const [attackResult, setAttackResult] = useState<'hit' | 'blocked' | 'stolen' | 'punch-hit' | 'parried' | 'boom' | undefined>();
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

  const screenSize = useWindowDimensions();
  const secretRow = useRef<ComponentRef<typeof View>>(null);
  const [smokeFrom, setSmokeFrom] = useState<Point | undefined>();
  const [beam, setBeam] = useState<{ readonly from: Point; readonly to: Point } | undefined>();
  const [blast, setBlast] = useState<Point | undefined>();
  const lastItemAt = useRef<Point | undefined>(undefined);
  useEffect(() => {
    if (beam === undefined) return undefined;
    const timer = setTimeout(() => setBeam(undefined), BEAM_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [beam]);
  useEffect(() => {
    if (blast === undefined) return undefined;
    const timer = setTimeout(() => setBlast(undefined), BLAST_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [blast]);

  const aimBeamAt = (from: Point, pegIndex: number) =>
    secretRow.current?.measureInWindow((x, y, width, height) =>
      setBeam({ from, to: { x: x + ((pegIndex + 0.5) * width) / SECRET_LENGTH, y: y + height / 2 } }),
    );

  const collect = (shown: Item) => {
    const response = useCases.collectItem.execute({ id: shown.id });
    setItem(undefined);
    if (response.kind !== 'collected') return;
    const received = response.gift ?? (response.item === 'present' ? undefined : response.item);
    if (received === undefined) return;
    setView(response.view);
    setItemNote(`${response.gift ? `${ITEM_ICONS.present} → ` : ''}${ITEM_ICONS[received]} ${GIFT_NOTES[received]}`);
    const from = itemPoint(shown, screenSize);
    if (received === 'smoke') {
      setSmokeFrom(from);
      setBlind(true);
    }
    if (received === 'charm') setCharmed(true);
    const xrayed = response.view.revealed[response.view.revealed.length - 1];
    if (received === 'xray' && xrayed !== undefined) aimBeamAt(from, xrayed.index);
    if (response.gift === 'bomb') {
      // a present's bomb goes off in the player's hands; a bomb tapped on the field is thrown away
      setBlast(from);
      setAttackResult('boom');
    }
  };
  const warningRef = useRef<{ readonly lane: number; readonly landsAt: number; readonly fallMs: number; readonly punch?: boolean; readonly fork?: boolean } | undefined>(undefined);
  const showWarning = (next: { readonly lane: number; readonly landsAt: number; readonly fallMs: number; readonly punch?: boolean; readonly fork?: boolean } | undefined) => {
    warningRef.current = next;
    setWarning(next);
  };

  const throwPunch = (punch: { readonly lane: number; readonly landsInMs: number }) =>
    showWarning({ lane: punch.lane, landsAt: Date.now() + punch.landsInMs, fallMs: punch.landsInMs, punch: true });

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
        const landedPunch = warningRef.current?.punch ? warningRef.current : undefined;
        setAttackResult(landedPunch ? (response.landed === 'hit' ? 'punch-hit' : 'parried') : response.landed);
        if (landedPunch) setReturningPunch(landedPunch.lane);
        setCharmed(false);
        showWarning(undefined);
      }
      if (response.attack !== undefined) {
        showWarning({
          lane: response.attack.lane,
          landsAt: Date.now() + response.attack.landsInMs,
          fallMs: response.attack.landsInMs,
          fork: response.attack.fork === true,
        });
      }
      if (response.exploded) {
        if (lastItemAt.current !== undefined) setBlast(lastItemAt.current);
        setAttackResult('boom');
      }
      if (response.item !== undefined) lastItemAt.current = itemPoint(response.item, screenSize);
      setItem(response.item);
      if (pegUpRef.current !== undefined && response.view.pegUp === undefined) {
        pegUpRef.current = undefined; // the guardian looked back with the peg still up: caught
        setPeeked(undefined);
        setCaught(true);
      }
      setView(response.view);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [playing, useCases]);
  const [puffs, setPuffs] = useState<readonly { readonly id: number; readonly at: Point }[]>([]);
  const nextPuff = useRef(0);

  useEffect(() => {
    if (!caught) return undefined;
    const timer = setTimeout(() => setCaught(false), CAUGHT_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [caught]);

  // AC23: after it lands, the glove is pulled back to the guardian
  const [returningPunch, setReturningPunch] = useState<number | undefined>();
  useEffect(() => {
    if (returningPunch === undefined) return undefined;
    const timer = setTimeout(() => setReturningPunch(undefined), PUNCH_RETURN_MS);
    return () => clearTimeout(timer);
  }, [returningPunch]);

  const [boardHeight, setBoardHeight] = useState(MOST_TURNS_SHOWN * TURN_ROW_HEIGHT);

  // AC22: a colour dragged from the palette lands in the slot it is dropped on
  const slotRefs = useRef<(ComponentRef<typeof View> | null)[]>([]);
  const [dragging, setDragging] = useState<{ readonly color: Color; readonly at: Point } | undefined>();
  const dropColor = (color: Color, at: Point) => {
    setDragging(undefined);
    slotRefs.current.forEach((slot, index) =>
      slot?.measureInWindow((x, y, width, height) => {
        const inside = at.x >= x && at.x <= x + width && at.y >= y && at.y <= y + height;
        if (inside) editDraft({ kind: 'place', color, slot: index });
      }),
    );
  };

  // the peg the player turned up stays up until they tap it again (AC20); the game catches one left up
  const pegUpRef = useRef<number | undefined>(undefined);

  const flipBack = (index: number) => {
    useCases.hidePeg.execute({ index });
    pegUpRef.current = undefined;
    setPeeked(undefined);
  };

  const peek = (index: number) => {
    const response = useCases.peekSecret.execute({ index });
    if (response.kind === 'revealed' || response.kind === 'caught') {
      setCooldown({ startedAt: Date.now(), cooldownMs: response.cooldownMs });
    }
    if (response.kind === 'rejected' && response.reason === 'cooling-down' && response.punch !== undefined) {
      throwPunch(response.punch);
    }
    if (response.kind === 'revealed') {
      setPeeked({ index, color: response.color });
      pegUpRef.current = index;
    }
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
    if (response.kind === 'punched') {
      setView(response.view);
      if (response.punch !== undefined) throwPunch(response.punch);
      return;
    }
    if (response.kind !== 'distracted') return;
    remainingMs.current = response.view.remainingMs;
    setGaze({ ...response.view.gaze });
  };

  // A tap meant for a peg, a control, an item or the shield is never a distraction, even where the
  // platform also hands it to the scene (seen on the phone: every peek was safe).
  const lastControlTouch = useRef(0);
  const touchedControl = () => {
    lastControlTouch.current = Date.now();
  };

  const pointAt = (event: GestureResponderEvent) => {
    if (Date.now() - lastControlTouch.current < CONTROL_TOUCH_MS) return;
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
  };

  const newGame = () => {
    const fresh = useCases.startGame.execute();
    setView(fresh);
    setCooldown({ startedAt: 0, cooldownMs: 0 });
    setTimeLeftMs(undefined);
    showWarning(undefined);
    setAttackResult(undefined);
    setItem(undefined);
    pegUpRef.current = undefined; // a peg left up in the last game is not this game's
    setPeeked(undefined);
    setBlind(false);
    setCharmed(false);
    moveShield(MIDDLE_LANE);
  };

  return (
    <Pressable testID="scene" style={styles.screen} onPress={pointAt}>
      <Text style={styles.title}>Yolognese</Text>
      <View ref={guardianRef} onLayout={measureGuardian}>
        <Guardian gaze={gaze} laughing={caught} />
      </View>
      <View ref={secretRow} style={styles.row} testID="secret" onTouchStart={touchedControl}>
        {(view.secret ?? EMPTY_DRAFT).map((color, slot) => {
          const xrayed = view.revealed.find((peg) => peg.index === slot)?.color;
          const up = view.secret === undefined && peeked?.index === slot;
          const shown = up ? peeked.color : (color ?? xrayed);
          const onPress = up ? () => flipBack(slot) : () => peek(slot);
          return <SecretPeg key={slot} testID={`secret-${slot}`} color={shown} onPress={playing ? onPress : undefined} />;
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
            {ATTACK_LINES[attackResult ?? (warning?.punch ? 'punch-coming' : warning?.fork ? 'fork-coming' : warning ? 'meatball-coming' : 'none')]}
          </Text>
          <Text testID="item-note" style={styles.itemNote}>
            {itemNote ?? (charmed ? '🍀 Shield charm ready' : ' ')}
          </Text>
        </>
      )}
      <View style={styles.board} onLayout={(event) => setBoardHeight(event.nativeEvent.layout.height)}>
        <View style={styles.boardContent}>
          {view.turns.slice(-turnsThatFit(boardHeight)).map((turn, shown, kept) => {
            const index = view.turns.length - kept.length + shown;
            return (
              <View key={index} style={styles.row} testID={`turn-${index}`}>
                <Text style={styles.turnNumber}>#{index + 1}</Text>
                {turn.guess.map((color, slot) => (
                  <Peg key={slot} color={color} size={30} />
                ))}
                <Feedback testID={`feedback-${index}`} exact={turn.exact} misplaced={turn.misplaced} />
              </View>
            );
          })}
        </View>
      </View>
      {playing ? (
        <View style={styles.controls} onTouchStart={touchedControl}>
          <View style={styles.row}>
            {draft.map((color, slot) => (
              <View key={slot} ref={(element) => { slotRefs.current[slot] = element; }}>
                <Peg testID={`slot-${slot}`} color={color} onPress={() => editDraft({ kind: 'clear', slot })} />
              </View>
            ))}
          </View>
          <View style={styles.row}>
            {COLORS.map((color) => (
              <DraggableColor
                key={color}
                color={color}
                onTap={() => editDraft({ kind: 'place', color })}
                onDrag={(dragged, at) => setDragging({ color: dragged, at })}
                onDrop={dropColor}
              />
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
      {playing && item !== undefined && (
        <ItemSprite item={item} onCollect={() => collect(item)} onTouchStart={touchedControl} />
      )}
      <View style={styles.playerZone} testID="player-zone" onTouchStart={touchedControl}>
        {playing && (
          <ShieldLanes shieldLane={shieldLane} warningLane={warning?.lane} onMove={moveShield} onMeasured={setGround} />
        )}
        <LifeBar life={view.life} maxLife={view.maxLife} />
      </View>
      {playing && warning !== undefined && ground !== undefined && (
        warning.punch ? (
          <PunchArm from={guardianCentre.current} to={laneTarget(ground, warning.lane)} durationMs={warning.fallMs} phase="out" lane={warning.lane} />
        ) : (
          <FallingMeatball from={guardianCentre.current} to={laneTarget(ground, warning.lane)} durationMs={warning.fallMs} lane={warning.lane} fork={warning.fork} />
        )
      )}
      {playing && returningPunch !== undefined && ground !== undefined && (
        <PunchArm from={guardianCentre.current} to={laneTarget(ground, returningPunch)} durationMs={PUNCH_RETURN_MS} phase="back" lane={returningPunch} />
      )}
      {playing && blind && smokeFrom !== undefined && <SmokeGrenade from={smokeFrom} at={guardianCentre.current} />}
      {playing && beam !== undefined && <XrayBeam from={beam.from} to={beam.to} />}
      {blast !== undefined && <Explosion at={blast} />}
      {playing && charmed && ground !== undefined && (
        <View testID="laser-shield" accessibilityLabel="green laser shield" pointerEvents="none" style={[styles.laser, { left: ground.x, top: ground.y - 6, width: ground.width }]} />
      )}
      {playing && view.playerBlind === true && <DarknessVeil />}
      {dragging !== undefined && (
        <View pointerEvents="none" testID="dragged-color" style={[styles.dragged, { left: dragging.at.x - DRAGGED_HALF, top: dragging.at.y - DRAGGED_HALF }]}>
          <Peg color={dragging.color} size={DRAGGED_HALF * 2} />
        </View>
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
  boardContent: { alignItems: 'center', paddingVertical: BOARD_PADDING },
  turnNumber: { color: THEME.ink, fontSize: 12, width: 26, textAlign: 'right', marginRight: 2 },
  row: { flexDirection: 'row', alignItems: 'center' },
  controls: { alignItems: 'center', marginTop: 8 },
  button: { backgroundColor: THEME.sauce, borderRadius: 24, paddingHorizontal: 32, paddingVertical: 12, marginTop: 8 },
  disabled: { opacity: 0.4 },
  caught: { color: THEME.sauce, fontWeight: 'bold' },
  itemNote: { color: THEME.ink, fontWeight: 'bold', minHeight: 20 },
  dragged: { position: 'absolute', opacity: 0.85 },
  laser: { position: 'absolute', height: 6, borderRadius: 3, backgroundColor: '#39ff14', shadowColor: '#39ff14', shadowOpacity: 1, shadowRadius: 10 },
  playerZone: { alignSelf: 'stretch', alignItems: 'center', marginTop: 4 },
  attackResult: { color: THEME.sauce, fontWeight: 'bold', minHeight: 20 },
  timer: { color: THEME.ink, fontSize: 16, fontWeight: 'bold', fontVariant: ['tabular-nums'] },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
