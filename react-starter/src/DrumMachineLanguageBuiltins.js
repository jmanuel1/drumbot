import { DrumMachineNoMatchError } from './DrumMachineLanguageErrors.js';

export default {
  'drum-machine': (state) => {
    const drumMachine = state.context;
    return {...state, stack: [...state.stack, drumMachine]};
  },
  pattern: (state) => {
    const stack = [...state.stack];
    const pattern = stack.pop(), machine = stack.pop();
    const patterns = machine.state.patterns.map(({ name }) => name);
    const patternIndex = patterns.indexOf(pattern);
    // console.debug(patternIndex);
    // push the promise so we can chain from it if necessary
    stack.push(machine.selectPattern(patternIndex).then(() => {
      machine.startClock();
    }));
    return {...state, stack};
  },
  console: (state) => {
    // we won't use the real console object
    const fakeConsole = {
      log: (state, str) => {return {...state, stdout: state.stdout + str}}
    };

    return {...state, stack: [...state.stack, fakeConsole]};
  },
  log: (state) => {
    const stack = [...state.stack];
    const str = stack.pop(), consoleObj = stack.pop();
    return {...state, ...consoleObj.log({...state, stack}, str)};
  },
  patterns: (state) => {
    const stack = [...state.stack];
    const machine = stack.pop();
    const patterns = machine.state.patterns.map(({ name }) => name);
    const out = patterns.toString();
    return {...state, stack, stdout: state.stdout + out};
  },
  'match-function': (state) => {
    const stack = [...state.stack];
    const func = stack.pop();
    const matches = [];

    // console.debug('Function to become a match function:', func);

    for (let i = 0; i < func.length; i += 2) {
      const pattern = func[i]({...state, stack: []}).stack;
      const result = func[i + 1];
      matches.push({pattern, result});
    }

    // console.debug('Pattern matches:', matches);

    const matchingFunction = new PatternMatchFunction(matches);

    stack.push(matchingFunction);
    return {...state, stack};
  },
  'extend-match-function': (state) => {
    const stack = [...state.stack];
    const [extension, func] = [stack.pop(), stack.pop()];
    const matches = [];

    for (let i = 0; i < extension.length; i += 2) {
      const pattern = extension[i]({...state, stack: []}).stack;
      const result = extension[i + 1];
      matches.push({pattern, result});
    }

    func.extendWith(matches);
    return {...state, stack};
  }
}

class PatternMatchFunction extends Function {
  constructor(matches) {
    super();
    this._matches = matches;
  }

  call(thisArg, state) {
    for (const match of this._matches) {
      let doesMatch = true;
      for (let i = match.pattern.length - 1, j = 1; i >= 0; i--, j++) {
        const element = match.pattern[i];
        if (state.stack[state.stack.length - j] !== element) {
          doesMatch = false;
        }
      }
      if (doesMatch) {
        return match.result(state);
      }
    }

    // no match
    throw new DrumMachineNoMatchError({state});
  }

  extendWith(matches) {
    this._matches = this._matches.concat(matches);
  }
}
