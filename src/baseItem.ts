export abstract class Item {
  abstract get PK(): string;
  abstract get SK(): string;

  public keys(): Record<string, string> {
    return {
      PK: this.PK,
      SK: this.SK,
    };
  }

  abstract toItem(): Record<string, unknown>;
}
