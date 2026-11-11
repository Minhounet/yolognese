import { Color } from '../domain/color';
import { EMPTY_DRAFT, clearSlot, placeColor } from '../domain/draft';
import { isOver } from '../domain/game';
import { toGameView } from './GameMapper';
import { Clock } from './ports';
import { SessionWork } from './SessionWork';
import { GameView } from './views';

/** A colour dropped on a slot (AC22) or tapped (first empty slot), or a slot emptied. */
export type EditDraftCommand =
  | { readonly kind: 'place'; readonly color: Color; readonly slot?: number }
  | { readonly kind: 'clear'; readonly slot: number };

export type EditDraftResponse =
  | { readonly kind: 'edited'; readonly view: GameView }
  | { readonly kind: 'rejected'; readonly reason: 'no-game' | 'game-over' };

/** Edits the row being composed, kept in the session so a present (AC33) or the fork (AC34) can change it. */
export interface EditDraft {
  execute(command: EditDraftCommand): Promise<EditDraftResponse>;
}

export class EditDraftImpl implements EditDraft {
  constructor(
    private readonly work: SessionWork,
    private readonly clock: Clock,
  ) {}

  execute(command: EditDraftCommand): Promise<EditDraftResponse> {
    return this.work.run<EditDraftResponse>((session) => {
      if (session === undefined) return { result: { kind: 'rejected', reason: 'no-game' } };
      if (isOver(session.game)) return { result: { kind: 'rejected', reason: 'game-over' } };
      const current = session.draft ?? EMPTY_DRAFT;
      const draft = command.kind === 'place' ? placeColor(current, command.color, command.slot) : clearSlot(current, command.slot);
      const edited = { ...session, draft };
      return { session: edited, result: { kind: 'edited', view: toGameView(edited.game, { session: edited, now: this.clock.now() }) } };
    });
  }
}
