export class DrumMachineCompileError extends Error {}

export class DrumMachineRuntimeError extends Error {
  constructor({originalError, state}) {
    super({originalError, state});
    this.originalError = originalError;
    this.state = state;
    console.debug(this.state);
    console.debug('Original error:', originalError);
    this.message = (`Original error: ${(this.originalError)}\n` +
      `State at time of error: ${JSON.stringify(this.state)}`);
  }
}

export class DrumMachineNoMatchError extends DrumMachineRuntimeError {}
export class DrumMachineLexerError extends Error {}
