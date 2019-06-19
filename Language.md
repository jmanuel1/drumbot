# Drum machine language examples

## Play a pattern

```
drum-machine 'bossanoopa' pattern
```

## Print all available patterns

```
drum-machine patterns
```

## Function definition

```
hello = `(console 'hello, world' log)
hello
```

This example will print `hello, world`.

## Extensible functions

```
`(('language' 'en') (console 'hello, world' log))
greet = match-function
'language' 'en' greet
```

Later, extend it:

```
`(('language' 'en') (console 'hello, world' log))
greet = match-function
`greet `(('language' 'es') (console 'hola, el mundo' log)) extend-match-function
'language' 'es' greet
```

This will print 'hola, el mundo'.
