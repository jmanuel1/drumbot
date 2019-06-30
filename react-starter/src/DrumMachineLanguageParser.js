export class CodeParser {
  constructor(tokens) {
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
          tlRoot.children.push(this.parseWord());
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
        throw new DrumMachineSyntaxError();
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
        throw new DrumMachineSyntaxError();
    }

    return literalNode;
  }

  hasNextWord() {
    return this._tokens.length > 0 && new Set(['identifier', 'string', 'backtick']).has(this._tokens[0].type);
  }

  consume(type) {
    if (this._tokens[0].type !== type) {
      throw new DrumMachineSyntaxError();
    }
    // don't modify original array
    this._tokens = [...this._tokens];
    return this._tokens.shift().content;
  }
}

class DrumMachineSyntaxError extends SyntaxError {}
