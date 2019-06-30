export class CodeLexer {
  constructor( ) {
    this._idRegex = /^[a-zA-Z-]+$/;
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

      if (!knowsTokenType) {
        if (this._idRegex.test(last().content) && !this._idRegex.test(last().content + next)) {
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
        default:
          tokens.pushOrReplaceEmpty({type: null, content: next});
      }
      knowsTokenType = !!last().type;

      return tokens;
    }, new TokenArray({type: 'start', content: ''}));
  }

  inferTokenType(next) {
    switch (next) {
      case '=':
        return 'equals';
      case '`':
        return 'backtick';
      case '(':
        return 'lparen';
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
