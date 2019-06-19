export class CodeLexer {
  constructor( ) {
    this._idRegex = /^[a-zA-Z\-]+$/;
  }

  lex(str) {
    // lexer state
    let isInString = false;
    let isAtStart = true;
    let knowsTokenType = false;
    let isInWhitespace = false;

    console.debug('String:', str);
    return [...str, '$end'].reduce((tokens, next) => {
      console.debug('Char:', next);
      const last = () => tokens[tokens.length - 1];
      console.debug('knowsTokenType:', last(), '->', knowsTokenType, '->', next);

      if (next === '$end') {
        if (last().content === '') {
          tokens.pop();
          return tokens;
        }
        this.forceTokenFinish(last());
        return tokens;
      }

      if (next === "'") {
        isInString = !isInString;
      }

      if (isInString) {
        if (next === "'") {
          tokens.pushOrReplaceEmpty({type: 'string', content: ''});
          knowsTokenType = true;
          return tokens;
        }
        last().content += next;
        return tokens;
      }

      if (!isInString && next === "'") {
        tokens.push({type: null, content: ''});
        knowsTokenType = false;
        return tokens;
      }

      if (isAtStart) {
        tokens.push({type: null, content: next});
        console.debug(tokens);
        isAtStart = knowsTokenType = false;
        return tokens;
      }

      const space = new Set([' ', '\n']);
      if (isInWhitespace) {
        if (!space.has(next)) {
          isInWhitespace = false;
          tokens.pushOrReplaceEmpty({type: null, content: next});
          knowsTokenType = false;
          // inferNewState(next);
        }
        return tokens;
      }
      if (!isInWhitespace) {
        if (space.has(next)) {
          isInWhitespace = true;
          this.forceTokenFinish(last());
          knowsTokenType = true;
          return tokens;
        }
      }

      const idRegex = /^[a-zA-Z\-]+$/;
      if (!knowsTokenType) {
        if (idRegex.test(last().content) && !idRegex.test(last().content + next)) {
          last().type = 'identifier';
        } else if (last().content === '=') {
          last().type = 'equals';
        } else if (last().content === '`') {
          last().type = 'backtick';
        } else if (last().content === '(') {
          last().type = 'lparen';
        } else if (last().content === ')') {
          last().type = 'rparen';
        }
        if (last().type) {
          const nextType = this.inferTokenType(next);
          tokens.push({type: nextType, content: next})
          knowsTokenType = !!nextType;
        } else {
          last().content += next;
        }
        return tokens;
      }

      switch (next) {
        case '=':
          tokens.pushOrReplaceEmpty({type: 'equals', content: '='});
          break;
        case '`':
          tokens.push({type: 'backtick', content: '`'});
          break;
        case '(':
          tokens.push({type: 'lparen', content: '('});
          break;
        case ')':
          tokens.pushOrReplaceEmpty({type: 'rparen', content: ')'});
          break;
      }
      knowsTokenType = !!last().type




      return tokens;
    }, new TokenArray({type: 'start', content: ''}));
  }

  inferTokenType(next) {
    switch (next) {
      case '=':
        return 'equals';
      case '`':
        return 'backtick';
      default:
        return null;
    }
  }

  forceTokenFinish(last) {
    if (this._idRegex.test(last.content)) {
      last.type = 'identifier';
    } else if (last.content === '=') {
      last.type = 'equals';
    } else if (last.content === ')') {
      last.type = 'rparen';
    }
  }
}

class TokenArray extends Array {
  pushOrReplaceEmpty(token) {
    const last = this[this.length - 1];
    if (!last.type && !last.content) {
      this[this.length - 1] = token;
      return this.length - 1;
    }
    return this.push(token);
  }
}

export class CodeParser {
  constructor (tokens) {
    this._tokens = tokens;
  }

  parse() {
    const astRoot = {type: 'root', children: []};

    this.consume('start');
    astRoot.children[0] = this.parseTopLevel();

    return astRoot;
  }

  parseTopLevel() {
    const tlRoot = {type: 'top-level', children: []};

    while (this.hasNextWord()) {
      switch (this._tokens[0].type) {
        case 'identifier':
          switch (this._tokens[1] && this._tokens[1].type) {
            case 'equals':
              tlRoot.children.push(this.parseAssignment());
              break;
            default:
              tlRoot.children.push(this.parseFunctionCall());
          }
          break;
        case 'string':
          tlRoot.children.push(this.parseLiteral());
          break;
        default:
          throw DrumMachineSyntaxError();
      }
    }

    return tlRoot;
  }

  parseAssignment() {
    const assignRoot = {type: 'assignment', children: []};
    const name = this.consume('identifier');
    this.consume('equals');
    const word = this.parseWord();
    assignRoot.children.push(name, word);
    return assignRoot;
  }

  parseWord() {
    switch (this._tokens[0].type) {
      case 'backtick':
        return this.parseQuote();
      case 'lparen':
        return this.parseList();
      case 'identifier':
        return this.parseFunctionCall();
      case 'string':
        return this.parseLiteral();
      default:
        throw DrumMachineSyntaxError();
    }
  }

  parseList() {
    const listRoot = {type: 'list', children: []};
    this.consume('lparen');
    while (this._tokens[0].type !== 'rparen') {
      listRoot.children.push(this.parseWord());
    }
    this.consume('rparen');
    return listRoot;
  }

  parseQuote() {
    const quoteRoot = {type: 'quote', children: []};
    this.consume('backtick');
    quoteRoot.children.push(this.parseWord());
    return quoteRoot;
  }

  parseFunctionCall() {
    const callRoot = {type: 'function-call', children: []};

    const id = this.consume('identifier');
    callRoot.children[0] = {type: 'name', content: id};

    return callRoot;
  }

  parseLiteral() {
    const literalNode = {type: 'literal', dataType: '', content: null};

    switch (this._tokens[0].type) {
      case 'string':
        literalNode.dataType = 'string';
        literalNode.content = this.consume('string');
        break;
      default:
        throw DrumMachineSyntaxError();
    }

    return literalNode;
  }

  hasNextWord() {
    return this._tokens.length > 0 && new Set(['identifier', 'string']).has(this._tokens[0].type);
  }

  consume(type) {
    if (this._tokens[0].type !== type) {
      throw DrumMachineSyntaxError();
    }
    // don't modify original array
    this._tokens = [...this._tokens];
    return this._tokens.shift().content;
  }
}

class DrumMachineSyntaxError extends SyntaxError {}

export class CodeCompiler {
  constructor() {
    this._program = [];
  }

  compile(ast) {
    const visitor = new ASTVisitor(ast);
    [
      'top-level->_onTopLevel',
      'function-call->_onCall',
      'literal->_onLiteral',
      'quote->_onQuote',
      'assignment->_onAssign'
    ].forEach((handler) => {
      const [type, fnName] = handler.split('->');
      console.debug(type, fnName);
      visitor.addHandler(type, (node) => this[fnName](node));
    });
    this._visitor = visitor;
    visitor.visit();
    return new Program(...this._program);
  }

  _onTopLevel(node) {
    const pushDrumMachine = (state) => {
      const drumMachine = state.context;
      return {...state, stack: [...state.stack, drumMachine]};
    }
    const playPattern = (state) => {
      const stack = [...state.stack];
      const pattern = stack.pop(), machine = stack.pop();
      const patterns = machine.state.patterns.map(({ name }) => name);
      const patternIndex = patterns.indexOf(pattern);
      // console.debug(machine.state.patterns);
      console.debug(patternIndex);
      // push the promise so we can chain fro it if necessary
      stack.push(machine.selectPattern(patternIndex).then(() => {
        machine.startClock();
      }));
      return {...state, stack};
    }
    const pushConsole = (state) => {
      // we won't use the real console object
      const fakeConsole = {log: (state, str) => {return {...state, stdout: state.stdout + str}}}

      return {...state, stack: [...state.stack, fakeConsole]}
    }
    const log = (state) => {
      const stack = [...state.stack];
      const str = stack.pop(), consoleObj = stack.pop();
      return {...state, ...consoleObj.log({...state, stack}, str)};
    }
    const displayPatterns = (state) => {
      const stack = [...state.stack];
      const machine = stack.pop();
      const patterns = machine.state.patterns.map(({ name }) => name);
      const out = patterns.toString();
      return {...state, stack, stdout: state.stdout + out};
    }
    this._program.push((state) => {
      return {...state, scope: {
        ...state.scope,
        'drum-machine': pushDrumMachine,
        'pattern': playPattern,
        'patterns': displayPatterns,
        'console': pushConsole,
        log
      }};
    });
  }

  _onCall(node) {
    if (node.children[0].type === 'name') {
      const name = node.children[0].content;
      this._program.push((state) => {
        return state.scope[name](state);
      });
      return;
    }
    throw DrumMachineCompileError();
  }

  _onAssign(node) {
    const [name, word] = node.children;
    // compile the word
    this._visitor.visit(word);
    word.doNotVisit = true;
    // we assign whatever is at the stop of the stack after executing the word
    this._program.push((state) => {
      const stack = [...state.stack];
      const value = stack.pop();
      return {...state, scope: {...state.scope, [name]: value}, stack};
    });
  }

  _onQuote(node) {
    const word = node.children[0];
    if (word.type === 'list') {
      this._program.push(this._quotedList(word));
      word.doNotVisit = true;
      return;
    }
    throw DrumMachineCompileError();
  }

  _quotedList(node) {
    const subvisitor = new ASTVisitor(node);
    // lie about the program
    const actualProgram = this._program;
    this._program = [];
    subvisitor.addHandler('function-call', (node) => {
      this._onCall(node);
    });
    subvisitor.addHandler('literal', (node) => {
      this._onLiteral(node);
    });
    subvisitor.visit();
    // restore actual program
    const quote = this._program;
    this._program = actualProgram;
    return (state) => {
      return {...state, stack: [...state.stack, new Quote(...quote)]};
    }
  }

  _onLiteral(node) {
    let value;
    switch (node.dataType) {
      case 'string':
        value = node.content;
        break;
      default:
        throw DrumMachineCompileError();
    }
    this._program.push((state) => {
      return {...state, stack: [...state.stack, value]};
    });
  }
}

class Quote extends Array {
  call(state) {
    return this.reduce((state, word) => word(state), state);
  }
}

class DrumMachineCompileError extends Error {}

class ASTVisitor {
  constructor(ast) {
    this._AST = ast;
    this._handlers = {};
  }

  addHandler(type, fn) {
    this._handlers[type] = fn;
  }

  visit(node = this._AST) {
    if (node.doNotVisit) return;

    console.debug(node);
    console.debug(this._handlers);
    if (this._handlers[node.type]) {
      this._handlers[node.type](node);
    }
    if (node.children) {
      node.children.forEach((child) => this.visit(child));
    }
    // node.doNotVisit = true;
  }
}

class Program extends Array {
  run(context, printOutput, onError) {
    // create state object
    const state = {context, stack: [], scope: {}, stdout: ''};

    let finalState;
    try {
      // the core of the executor
      finalState = this.reduce((state, nextStep) => {
        try {
          return nextStep(state);
        } catch (err) {
          throw new DrumMachineRuntimeError({originalError: err, state});
        }
      }, state);
      // output
      printOutput(finalState.stdout);
    } catch (err) {
      onError(err);
    }
  }
}

class DrumMachineRuntimeError extends Error {
  constructor({originalError, state}) {
    super({originalError, state});
    this.originalError = originalError;
    this.state = state;
    console.debug(this.state);
    this.message = (`Original error: ${JSON.stringify(this.originalError)}\n` +
      `State at time of error: ${JSON.stringify(this.state)}`);
  }

  // toString() {
  //   return (`Original error: ${JSON.stringify(this.originalError)}\n` +
  //     `State at time of error: ${JSON.stringify(this.state)}`);
  // }
}