import { Code, Color } from '../domain/color';
import { Draft } from '../domain/draft';
import { Game } from '../domain/game';
import { Guardian } from '../domain/guardian';
import { Item } from '../domain/items';
import { MatchState, RoomEvent, Steal } from '../domain/steal';
import { DuelOutcome, Penalty } from '../domain/duel';
import { ShellGame } from '../domain/shellGame';
import { RevealedPegView } from './views';

export interface RandomSource {
  nextInt(maxExclusive: number): number;
}

export interface Clock {
  now(): number;
}

export interface Session {
  readonly game: Game;
  readonly guardian: Guardian;
  readonly peekReadyAt: number;
  readonly endsAt: number;
  readonly attackAt?: number;
  readonly itemAt?: number;
  readonly item?: Item;
  readonly itemCollected?: boolean;
  readonly attackLandsAt?: number;
  readonly attackLane?: number;
  readonly attackIsPunch?: boolean;
  readonly shieldLane?: number;
  readonly charmed?: boolean;
  readonly darkUntil?: number;
  readonly pegUp?: RevealedPegView;
  /** AC33/AC34: the row being composed, kept here so a present or the fork can change it. */
  readonly draft?: Draft;
  readonly attackIsFork?: boolean;
  /** AC32: the peg the x-ray glasses show, until when (its colour comes from the server in "steal the sauce"). */
  readonly xray?: { readonly index: number; readonly until: number; readonly color?: Color };
  /** "Steal the sauce": the match, as the server last said it. */
  readonly steal?: Steal;
  /** Round 15 (AC3): the shell game on the table, and when it ended (picked or too late). */
  readonly shell?: ShellGame & { readonly endedAt?: number };
  /** Round 15 (AC4): the duel this player is in. */
  readonly duel?: Duel;
  /** Round 15 (AC5): the last duel's verdict, shown a moment. */
  readonly duelResult?: DuelResult;
  /** Duels already applied here (a match hears a verdict twice: from the room and in an answer). */
  readonly duelsDone?: readonly string[];
  /** Round 15 (AC5): the palette lies until then: tapping colour i places colour map[i]. */
  readonly scramble?: { readonly until: number; readonly map: readonly number[] };
  readonly flippedUntil?: number;
  /** Round 15 (AC6, solo): when the guardian taunts next. */
  readonly guardianTauntAt?: number;
}

/** Solo: what the guardian's side was drawn in advance, so the rules applied with time need no luck. */
export interface Stakes {
  /** The penalty if this player wins, and if it loses. */
  readonly ifWon: Penalty;
  readonly ifLost: Penalty;
  /** A shown peg (the secret's), and the lying palette's shift. */
  readonly pegIndex: number;
  readonly scrambleShift: number;
}

export type Duel =
  | { readonly phase: 'choosing'; readonly offered: readonly number[] }
  /** The taunter waits: for the guardian's answer (solo, drawn in advance) or the server's verdict (a match). */
  | {
      readonly phase: 'waiting';
      readonly insult: number;
      /** 'guardian', or the player's id. */
      readonly opponent: string;
      readonly until: number;
      readonly id?: string;
      readonly asked?: boolean;
      readonly guardian?: { readonly at: number; readonly comeback: number; readonly stakes: Stakes };
    }
  /** The taunted chooses a comeback until `until`. */
  | {
      readonly phase: 'answering';
      readonly insult: number;
      readonly from: string;
      readonly choices: readonly number[];
      readonly until: number;
      readonly id?: string;
      readonly answered?: number;
      readonly asked?: boolean;
      readonly stakes?: Stakes;
    };

export interface DuelResult {
  readonly won: boolean;
  readonly penalty: Penalty;
  /** 'guardian', or the player's id. */
  readonly opponent: string;
  readonly at: number;
}

/** Where the session is kept. Asynchronous, whatever the adapter: memory, device storage or a remote table. */
export interface GameRepository {
  load(): Promise<Session | undefined>;
  save(session: Session): Promise<void>;
}

/** What a player tells the room about itself. */
export interface MemberInfo {
  readonly name: string;
  readonly joinedAt: number;
}

export interface Member extends MemberInfo {
  readonly id: string;
}

export type RoomStatus = 'connecting' | 'joined' | 'failed';

export interface RoomListener {
  onMembers(members: readonly Member[]): void;
  onEvent(event: RoomEvent): void;
  onStatus(status: RoomStatus): void;
}

/** A room where players meet: who is in it, and what the match server says to it. */
export interface Room {
  readonly me: Member;
  /** Everyone in the room, first arrived first. */
  members(): readonly Member[];
  leave(): void;
}

export interface RoomGateway {
  /** Joins as this player's identity (the same one the match server knows). */
  join(code: string, info: Omit<MemberInfo, 'joinedAt'>, listener: RoomListener): Promise<Room>;
}

export type GuessAnswer =
  | { readonly kind: 'scored'; readonly exact: number; readonly misplaced: number; readonly target: string; readonly state: MatchState }
  | { readonly kind: 'match-over'; readonly state: MatchState };

/**
 * "Steal the sauce" is refereed by a server: it holds every sauce and the
 * scores, scores the guesses and turns the circle. It also tells the room what
 * changed; these answers are for the player who asked.
 */
export interface MatchServer {
  setSauce(roomCode: string, sauce: Code): Promise<void>;
  /** Called by the host, first in `players`. */
  start(roomCode: string, players: readonly { readonly id: string; readonly name: string }[]): Promise<MatchState>;
  guess(matchId: string, code: Code): Promise<GuessAnswer>;
  /** One peg of the current target's sauce; undefined when asked too fast. */
  peek(matchId: string, index: number): Promise<Color | undefined>;
  /** Lets due switches happen; answers the state. */
  sync(matchId: string): Promise<MatchState>;
  knockout(matchId: string): Promise<MatchState>;
  mySauce(matchId: string): Promise<Code>;
  /** Round 14: throws ink at the caller's current target; false when asked too fast. */
  ink(matchId: string): Promise<boolean>;
  /** Round 15: taunts the caller's current target; the duel's id, or undefined when refused (too fast, a duel open). */
  taunt(matchId: string, insult: number): Promise<string | undefined>;
  /** Round 15: the taunted player's comeback; answers the verdict. */
  retort(tauntId: string, comeback: number): Promise<DuelOutcome>;
  /** Round 15: the verdict (settled if its time is up; with the peg for a winner of 🔍), or undefined while it is open. */
  tauntResult(tauntId: string): Promise<DuelOutcome | undefined>;
}

/** Runs a task later. */
export interface Scheduler {
  /** Runs `task` after `ms`; answers a function that cancels it. */
  after(ms: number, task: () => void): () => void;
}

/** A separate identity on the network, for a test bot: its own room membership and server calls. */
export interface BotConnection {
  readonly gateway: RoomGateway;
  readonly server: MatchServer;
}
