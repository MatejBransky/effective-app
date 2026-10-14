import { Context, Effect, Layer } from "effect";

// interface (class extends Context.Service)
class Config extends Context.Service<
  Config,
  {
    readonly getConfig: Effect.Effect<{
      readonly loglevel: string;
      readonly connection: string;
    }>;
  }
>()("Config") {}

// implementation (Layer.succeed(interface, implementation))
const ConfigLive = Layer.succeed(Config, {
  getConfig: Effect.succeed({
    loglevel: "info",
    connection: "mongodb://localhost:27017/mydb",
  }),
});

await Effect.runPromise(
  Effect.provide(Config.pipe(Effect.andThen((c) => c.getConfig)), ConfigLive),
);

// interface (class extends Context.Service)
class Logger extends Context.Service<
  Logger,
  {
    readonly log: (message: string) => Effect.Effect<void>;
  }
>()("Logger") {}

// implementation (Layer.effect(interface, Effect.gen(function* () { implementation }))
const LoggerLive = Layer.effect(
  Logger,
  Effect.gen(function* () {
    const config = yield* Config;

    return {
      log: (message: string) =>
        Effect.gen(function* () {
          const { loglevel } = yield* config.getConfig;
          console.log(`[${loglevel}] ${message}`);
        }),
    };
  }),
);

// implementation with dependencies (Layer.provide(implementation, Layer.mergeAll(dependencyA, dependencyB, ...)))
const loggerWithDependencies = Layer.provide(LoggerLive, ConfigLive);

// actual usage (Effect.gen(function* () { ... }))
const program = Effect.gen(function* () {
  const logger = yield* Logger;
  yield* logger.log("Hello, World!");
});

// program with dependencies (program.pipe(Effect.provide(implementationWithDependencies)))
const provided = program.pipe(Effect.provide(loggerWithDependencies));

// run the program (Effect.runPromise(provided))
await Effect.runPromise(provided);
