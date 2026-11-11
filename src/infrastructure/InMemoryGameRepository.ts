import { GameRepository, Session } from '../application/ports';

export class InMemoryGameRepository implements GameRepository {
  private session: Session | undefined = undefined;

  async load(): Promise<Session | undefined> {
    return this.session;
  }

  async save(session: Session): Promise<void> {
    this.session = session;
  }
}
