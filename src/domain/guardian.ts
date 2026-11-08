export interface Guardian {
  readonly distracted: boolean;
}

export const WATCHING: Guardian = { distracted: false };

export const DISTRACTED: Guardian = { distracted: true };
