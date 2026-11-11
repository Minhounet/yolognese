import { Color } from '../domain/color';
import { clear, place } from '../domain/round';
import { ActionResponse, RoundAction } from './RoundAction';

export type EditDraftCommand =
  | { readonly kind: 'place'; readonly color: Color }
  | { readonly kind: 'clear'; readonly slot: number };

/** Edits the row being composed, kept in the round so the guardian's fork can steal from it. */
export interface EditDraft {
  execute(command: EditDraftCommand): Promise<ActionResponse>;
}

export class EditDraftImpl implements EditDraft {
  constructor(private readonly action: RoundAction) {}

  execute(command: EditDraftCommand): Promise<ActionResponse> {
    return this.action.run((round) =>
      command.kind === 'place' ? place(round, command.color) : clear(round, command.slot),
    );
  }
}
