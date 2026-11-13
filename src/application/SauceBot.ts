import { nextGuess, targetSeat } from '../domain/botBrain';
import { Turn } from '../domain/game';
import { MatchState, RoomEvent } from '../domain/steal';
import { INSULT_COUNT } from '../domain/duel';
import { BotConnection, RandomSource, Room, Scheduler } from './ports';
import { drawSecret } from './StartGame';

const GUESS_EVERY_MS = 7_000;
const GUESS_SPREAD_MS = 4_000;
/** Round 14: a bot throws ink at its target every 12 to 35 s, so a lone tester gets inked too. */
const INK_EVERY_MS = 12_000;
const INK_SPREAD_MS = 23_000;
/** Round 15 (AC7): a bot answers a taunt after 1.5 to 4 s, right 2 times in 5, and taunts its target every 35 to 60 s. */
const ANSWER_AFTER_MS = 1_500;
const ANSWER_SPREAD_MS = 2_500;
const RIGHT_IN = 5;
const RIGHT_TIMES = 2;
const TAUNT_EVERY_MS = 35_000;
const TAUNT_SPREAD_MS = 25_000;
/** It asks for the verdict once the taunted player's time is up (the server settles it then). */
const VERDICT_AFTER_MS = 6_500;

/**
 * A test bot for "steal the sauce", so one phone can try a match with several
 * players. It joins the room as a player of its own (its own identity on the
 * server), hides a random sauce, and once a match starts guesses its current
 * target every 7 to 11 s, carelessly (see nextGuess). It never peeks, uses no
 * item but ink (round 14: one every 12 to 35 s, at its target) and is never knocked out.
 * Round 15: it duels (AC7): it answers a taunt, often wrong, and taunts its target
 * now and then; a penalty means nothing to it (it has no screen and no life).
 */
export class SauceBot {
  private room?: Room;
  private state?: MatchState;
  /** Its guesses on each sauce (`player@version`). */
  private readonly memory = new Map<string, Turn[]>();
  private cancel: () => void = () => undefined;
  private cancelInk: () => void = () => undefined;
  private cancelTaunt: () => void = () => undefined;
  private left = false;

  constructor(
    private readonly connection: BotConnection,
    private readonly random: RandomSource,
    private readonly scheduler: Scheduler,
    private readonly care = 0.5,
    /** Round 15: whether it taunts (the browser checks of other rounds turn it off). */
    private readonly taunts = true,
  ) {}

  async join(roomCode: string, name: string): Promise<void> {
    this.room = await this.connection.gateway.join(roomCode, { name }, {
      onMembers: () => undefined,
      onStatus: () => undefined,
      onEvent: (event) => this.hear(event),
    });
    await this.connection.server.setSauce(roomCode, drawSecret(this.random));
  }

  leave(): void {
    this.left = true;
    this.cancel();
    this.cancelInk();
    this.cancelTaunt();
    this.room?.leave();
  }

  private hear(event: RoomEvent): void {
    if (event.type === 'taunt') return this.taunted(event);
    if (event.type !== 'state' || this.room === undefined) return;
    const me = this.room.me.id;
    if (!event.state.seats.some(({ id }) => id === me)) return;
    const fresh = event.cause.kind === 'start' && event.state.matchId !== this.state?.matchId;
    this.take(event.state);
    if (fresh) {
      this.memory.clear();
      this.plan();
      this.planInk();
      this.planTaunt();
    }
  }

  /** AC7: taunted, it answers after a while, with its insult's own comeback 2 times in 5. */
  private taunted(event: Extract<RoomEvent, { type: 'taunt' }>): void {
    if (this.left || event.target !== this.room?.me.id) return;
    const wait = ANSWER_AFTER_MS + this.random.nextInt(ANSWER_SPREAD_MS + 1);
    const right = this.random.nextInt(RIGHT_IN) < RIGHT_TIMES;
    const comeback = right ? event.insult : (event.insult + 1 + this.random.nextInt(INSULT_COUNT - 1)) % INSULT_COUNT;
    this.scheduler.after(wait, () => {
      if (!this.left) void this.connection.server.retort(event.id, comeback).catch(() => undefined);
    });
  }

  private planTaunt(): void {
    this.cancelTaunt();
    if (!this.taunts || this.left || this.state?.finished) return;
    const wait = TAUNT_EVERY_MS + this.random.nextInt(TAUNT_SPREAD_MS + 1);
    this.cancelTaunt = this.scheduler.after(wait, () => void this.taunt());
  }

  private async taunt(): Promise<void> {
    const state = this.state;
    if (state === undefined || this.left) return;
    const id = await this.connection.server.taunt(state.matchId, this.random.nextInt(INSULT_COUNT)).catch(() => undefined);
    if (id !== undefined) {
      this.scheduler.after(VERDICT_AFTER_MS, () => {
        if (!this.left) void this.connection.server.tauntResult(id).catch(() => undefined);
      });
    }
    this.planTaunt();
  }

  /** Keeps the newest state of the current match. */
  private take(state: MatchState): void {
    if (this.state !== undefined && state.matchId === this.state.matchId && state.rotation < this.state.rotation) return;
    this.state = state;
  }

  private plan(): void {
    this.cancel();
    if (this.left || this.state?.finished) return;
    const wait = GUESS_EVERY_MS + this.random.nextInt(GUESS_SPREAD_MS + 1);
    this.cancel = this.scheduler.after(wait, () => void this.play());
  }

  private planInk(): void {
    this.cancelInk();
    if (this.left || this.state?.finished) return;
    const wait = INK_EVERY_MS + this.random.nextInt(INK_SPREAD_MS + 1);
    this.cancelInk = this.scheduler.after(wait, () => void this.throwInk());
  }

  private async throwInk(): Promise<void> {
    const state = this.state;
    if (state === undefined || this.left) return;
    await this.connection.server.ink(state.matchId).catch(() => false);
    this.planInk();
  }

  private async play(): Promise<void> {
    const state = this.state;
    const me = this.room?.me.id;
    if (state === undefined || me === undefined || this.left) return;
    const seat = state.seats.findIndex(({ id }) => id === me);
    const target = state.seats[targetSeat(seat, state.rotation, state.seats.length)];
    const key = `${target.id}@${target.version}`;
    const turns = this.memory.get(key) ?? [];
    const guess = nextGuess(turns, (max) => this.random.nextInt(max), this.care);
    try {
      const answer = await this.connection.server.guess(state.matchId, guess);
      if (answer.kind === 'scored' && answer.target === target.id) {
        this.memory.set(key, [...turns, { guess, exact: answer.exact, misplaced: answer.misplaced }]);
      }
      this.take(answer.state);
    } catch {
      // a lost answer: try again next time
    }
    this.plan();
  }
}
