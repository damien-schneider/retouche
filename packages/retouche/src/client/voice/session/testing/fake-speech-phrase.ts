export class FakeSpeechPhrase {
  readonly phrase: string;
  readonly boost: number;

  constructor(phrase: string, boost: number) {
    this.phrase = phrase;
    this.boost = boost;
  }
}
