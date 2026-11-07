import { GameRepository, Session } from '../application/ports';

export class InMemoryGameRepository implements GameRepository {
  private session: Session | undefined = undefined;

  load(): Session | undefined {
    return this.session;
  }

  save(session: Session): void {
    this.session = session;
  }
}
