import {
  DrumMachineRuntimeError, DrumMachineCompileError
} from './DrumMachineLanguageErrors.js';
import builtins from './DrumMachineLanguageBuiltins.js';

export class CodeCompiler {
  static _builtins = builtins;

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
      'assignment->_onAssign',
      'list->_onList'
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
    console.debug('Adding builtins:', this.constructor._builtins);
    this._program.push((state) => {
      return {...state, scope: {
        ...state.scope,
        ...this.constructor._builtins
      }};
    });
  }

  _onCall(node) {
    if (node.children[0].type === 'name') {
      const name = node.children[0].content;
      this._program.push((state) => {
        const thisArg = {};
        return state.scope[name].call(thisArg, state);
      });
      return;
    }
    throw new DrumMachineCompileError();
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

  _onList(node) {
    const contents = [];
    const actualProgram = this._program;
    this._program = contents;
    node.children.forEach((child) => {
      this._visitor.visit(child);
      child.doNotVisit = true;
    });
    this._program = actualProgram;
    this._program.push((state) => {
      return new Quote(...contents).call({}, state);
    });
  }

  _onQuote(node) {
    const word = node.children[0];
    if (word.type === 'list') {
      this._program.push(this._quotedList(word));
      word.doNotVisit = true;
      return;
    } else if (word.type === 'function-call') {
      this._program.push((state) => {
        // push something from scope directly onto the stack
        return {
          ...state,
          stack: [...state.stack, state.scope[word.children[0].content]]
        };
      });
      word.doNotVisit = true;
      return;
    }
    throw new DrumMachineCompileError();
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
    subvisitor.addHandler('list', (node) => {
      this._onList(node);
    });
    // skip the root of the list
    node.children.forEach((child) => subvisitor.visit(child));
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
        throw new DrumMachineCompileError();
    }
    this._program.push((state) => {
      return {...state, stack: [...state.stack, value]};
    });
  }
}

class Quote extends Array {
  call(thisArg, state) {
    return this.reduce((state, word) => word.call(thisArg, state), state);
  }
}

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
          throw err instanceof DrumMachineRuntimeError ?
            err : new DrumMachineRuntimeError({originalError: err, state});
        }
      }, state);
      // output
      printOutput(finalState.stdout);
    } catch (err) {
      onError(err);
    }
  }
}
