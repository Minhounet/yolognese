import { nextGuess, targetSeat } from '../domain/botBrain';
import { Turn } from '../domain/game';
import { MatchState, RoomEvent } from '../domain/steal';
import { BotConnection, RandomSource, Room, Scheduler } from './ports';
import { drawSecret } from './StartGame';

const GUESS_EVERY_MS = 7_000;
const GUESS_SPREAD_MS = 4_000;
/** Round 14: a bot throws ink at its target every 12 to 35 s, so a lone tester gets inked too. */
const INK_EVERY_MS = 12_000;
const INK_SPREAD_MS = 23_000;

/**
 * A test bot for "steal the sauce", so one phone can try a match with several
 * players. It joins the room as a player of its own (its own identity on the
 * server), hides a random sauce, and once a match starts guesses its current
 * target every 7 to 11 s, carelessly (see nextGuess). It never peeks, uses no
 * item but ink (round 14: one every 12 to 35 s, at its target) and is never knocked out.
 */
export class SauceBot {
  private room?: Room;
  private state?: MatchState;
  /** Its guesses on each sauce (`player@version`). */
  private readonly memory = new Map<string, Turn[]>();
  private cancel: () => void = () => undefined;
  private cancelInk: () => void = () => undefined;
  private left = false;

  constructor(
    private readonly connection: BotConnection,
    private readonly random: RandomSource,
    private readonly scheduler: Scheduler,
    private readonly care = 0.5,
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
    this.room?.leave();
  }

  private hear(event: RoomEvent): void {
    if (event.type !== 'state' || this.room === undefined) return;
    const me = this.room.me.id;
    if (!event.state.seats.some(({ id }) => id === me)) return;
    const fresh = event.cause.kind === 'start' && event.state.matchId !== this.state?.matchId;
    this.take(event.state);
    if (fresh) {
      this.memory.clear();
      this.plan();
      this.planInk();
    }
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
