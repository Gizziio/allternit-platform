
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model User
 * 
 */
export type User = $Result.DefaultSelection<Prisma.$UserPayload>
/**
 * Model SshConnection
 * 
 */
export type SshConnection = $Result.DefaultSelection<Prisma.$SshConnectionPayload>
/**
 * Model RemoteBackendTarget
 * 
 */
export type RemoteBackendTarget = $Result.DefaultSelection<Prisma.$RemoteBackendTargetPayload>
/**
 * Model UserBackendPreference
 * 
 */
export type UserBackendPreference = $Result.DefaultSelection<Prisma.$UserBackendPreferencePayload>

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Users
 * const users = await prisma.user.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  const U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more Users
   * const users = await prisma.user.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.user`: Exposes CRUD operations for the **User** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Users
    * const users = await prisma.user.findMany()
    * ```
    */
  get user(): Prisma.UserDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.sshConnection`: Exposes CRUD operations for the **SshConnection** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more SshConnections
    * const sshConnections = await prisma.sshConnection.findMany()
    * ```
    */
  get sshConnection(): Prisma.SshConnectionDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.remoteBackendTarget`: Exposes CRUD operations for the **RemoteBackendTarget** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more RemoteBackendTargets
    * const remoteBackendTargets = await prisma.remoteBackendTarget.findMany()
    * ```
    */
  get remoteBackendTarget(): Prisma.RemoteBackendTargetDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.userBackendPreference`: Exposes CRUD operations for the **UserBackendPreference** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more UserBackendPreferences
    * const userBackendPreferences = await prisma.userBackendPreference.findMany()
    * ```
    */
  get userBackendPreference(): Prisma.UserBackendPreferenceDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 6.19.2
   * Query Engine version: c2990dca591cba766e3b7ef5d9e8a84796e47ab7
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import Bytes = runtime.Bytes
  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    User: 'User',
    SshConnection: 'SshConnection',
    RemoteBackendTarget: 'RemoteBackendTarget',
    UserBackendPreference: 'UserBackendPreference'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "user" | "sshConnection" | "remoteBackendTarget" | "userBackendPreference"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      User: {
        payload: Prisma.$UserPayload<ExtArgs>
        fields: Prisma.UserFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UserFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UserFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findFirst: {
            args: Prisma.UserFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UserFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findMany: {
            args: Prisma.UserFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          create: {
            args: Prisma.UserCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          createMany: {
            args: Prisma.UserCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.UserCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          delete: {
            args: Prisma.UserDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          update: {
            args: Prisma.UserUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          deleteMany: {
            args: Prisma.UserDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UserUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.UserUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          upsert: {
            args: Prisma.UserUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          aggregate: {
            args: Prisma.UserAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUser>
          }
          groupBy: {
            args: Prisma.UserGroupByArgs<ExtArgs>
            result: $Utils.Optional<UserGroupByOutputType>[]
          }
          count: {
            args: Prisma.UserCountArgs<ExtArgs>
            result: $Utils.Optional<UserCountAggregateOutputType> | number
          }
        }
      }
      SshConnection: {
        payload: Prisma.$SshConnectionPayload<ExtArgs>
        fields: Prisma.SshConnectionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.SshConnectionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SshConnectionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.SshConnectionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SshConnectionPayload>
          }
          findFirst: {
            args: Prisma.SshConnectionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SshConnectionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.SshConnectionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SshConnectionPayload>
          }
          findMany: {
            args: Prisma.SshConnectionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SshConnectionPayload>[]
          }
          create: {
            args: Prisma.SshConnectionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SshConnectionPayload>
          }
          createMany: {
            args: Prisma.SshConnectionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.SshConnectionCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SshConnectionPayload>[]
          }
          delete: {
            args: Prisma.SshConnectionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SshConnectionPayload>
          }
          update: {
            args: Prisma.SshConnectionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SshConnectionPayload>
          }
          deleteMany: {
            args: Prisma.SshConnectionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.SshConnectionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.SshConnectionUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SshConnectionPayload>[]
          }
          upsert: {
            args: Prisma.SshConnectionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SshConnectionPayload>
          }
          aggregate: {
            args: Prisma.SshConnectionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateSshConnection>
          }
          groupBy: {
            args: Prisma.SshConnectionGroupByArgs<ExtArgs>
            result: $Utils.Optional<SshConnectionGroupByOutputType>[]
          }
          count: {
            args: Prisma.SshConnectionCountArgs<ExtArgs>
            result: $Utils.Optional<SshConnectionCountAggregateOutputType> | number
          }
        }
      }
      RemoteBackendTarget: {
        payload: Prisma.$RemoteBackendTargetPayload<ExtArgs>
        fields: Prisma.RemoteBackendTargetFieldRefs
        operations: {
          findUnique: {
            args: Prisma.RemoteBackendTargetFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RemoteBackendTargetPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.RemoteBackendTargetFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RemoteBackendTargetPayload>
          }
          findFirst: {
            args: Prisma.RemoteBackendTargetFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RemoteBackendTargetPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.RemoteBackendTargetFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RemoteBackendTargetPayload>
          }
          findMany: {
            args: Prisma.RemoteBackendTargetFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RemoteBackendTargetPayload>[]
          }
          create: {
            args: Prisma.RemoteBackendTargetCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RemoteBackendTargetPayload>
          }
          createMany: {
            args: Prisma.RemoteBackendTargetCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.RemoteBackendTargetCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RemoteBackendTargetPayload>[]
          }
          delete: {
            args: Prisma.RemoteBackendTargetDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RemoteBackendTargetPayload>
          }
          update: {
            args: Prisma.RemoteBackendTargetUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RemoteBackendTargetPayload>
          }
          deleteMany: {
            args: Prisma.RemoteBackendTargetDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.RemoteBackendTargetUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.RemoteBackendTargetUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RemoteBackendTargetPayload>[]
          }
          upsert: {
            args: Prisma.RemoteBackendTargetUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RemoteBackendTargetPayload>
          }
          aggregate: {
            args: Prisma.RemoteBackendTargetAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateRemoteBackendTarget>
          }
          groupBy: {
            args: Prisma.RemoteBackendTargetGroupByArgs<ExtArgs>
            result: $Utils.Optional<RemoteBackendTargetGroupByOutputType>[]
          }
          count: {
            args: Prisma.RemoteBackendTargetCountArgs<ExtArgs>
            result: $Utils.Optional<RemoteBackendTargetCountAggregateOutputType> | number
          }
        }
      }
      UserBackendPreference: {
        payload: Prisma.$UserBackendPreferencePayload<ExtArgs>
        fields: Prisma.UserBackendPreferenceFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UserBackendPreferenceFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserBackendPreferencePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UserBackendPreferenceFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserBackendPreferencePayload>
          }
          findFirst: {
            args: Prisma.UserBackendPreferenceFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserBackendPreferencePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UserBackendPreferenceFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserBackendPreferencePayload>
          }
          findMany: {
            args: Prisma.UserBackendPreferenceFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserBackendPreferencePayload>[]
          }
          create: {
            args: Prisma.UserBackendPreferenceCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserBackendPreferencePayload>
          }
          createMany: {
            args: Prisma.UserBackendPreferenceCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.UserBackendPreferenceCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserBackendPreferencePayload>[]
          }
          delete: {
            args: Prisma.UserBackendPreferenceDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserBackendPreferencePayload>
          }
          update: {
            args: Prisma.UserBackendPreferenceUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserBackendPreferencePayload>
          }
          deleteMany: {
            args: Prisma.UserBackendPreferenceDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UserBackendPreferenceUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.UserBackendPreferenceUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserBackendPreferencePayload>[]
          }
          upsert: {
            args: Prisma.UserBackendPreferenceUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserBackendPreferencePayload>
          }
          aggregate: {
            args: Prisma.UserBackendPreferenceAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUserBackendPreference>
          }
          groupBy: {
            args: Prisma.UserBackendPreferenceGroupByArgs<ExtArgs>
            result: $Utils.Optional<UserBackendPreferenceGroupByOutputType>[]
          }
          count: {
            args: Prisma.UserBackendPreferenceCountArgs<ExtArgs>
            result: $Utils.Optional<UserBackendPreferenceCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Shorthand for `emit: 'stdout'`
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events only
     * log: [
     *   { emit: 'event', level: 'query' },
     *   { emit: 'event', level: 'info' },
     *   { emit: 'event', level: 'warn' }
     *   { emit: 'event', level: 'error' }
     * ]
     * 
     * / Emit as events and log to stdout
     * og: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     *  { emit: 'stdout', level: 'error' }
     * 
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale`
     */
    adapter?: runtime.SqlDriverAdapterFactory | null
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
  }
  export type GlobalOmitConfig = {
    user?: UserOmit
    sshConnection?: SshConnectionOmit
    remoteBackendTarget?: RemoteBackendTargetOmit
    userBackendPreference?: UserBackendPreferenceOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;

  export type GetLogType<T> = CheckIsLogLevel<
    T extends LogDefinition ? T['level'] : T
  >;

  export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition>
    ? GetLogType<T[number]>
    : never;

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type UserCountOutputType
   */

  export type UserCountOutputType = {
    sshConnections: number
    remoteBackendTargets: number
  }

  export type UserCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    sshConnections?: boolean | UserCountOutputTypeCountSshConnectionsArgs
    remoteBackendTargets?: boolean | UserCountOutputTypeCountRemoteBackendTargetsArgs
  }

  // Custom InputTypes
  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserCountOutputType
     */
    select?: UserCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountSshConnectionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SshConnectionWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountRemoteBackendTargetsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: RemoteBackendTargetWhereInput
  }


  /**
   * Count Type RemoteBackendTargetCountOutputType
   */

  export type RemoteBackendTargetCountOutputType = {
    activeForUsers: number
  }

  export type RemoteBackendTargetCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    activeForUsers?: boolean | RemoteBackendTargetCountOutputTypeCountActiveForUsersArgs
  }

  // Custom InputTypes
  /**
   * RemoteBackendTargetCountOutputType without action
   */
  export type RemoteBackendTargetCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RemoteBackendTargetCountOutputType
     */
    select?: RemoteBackendTargetCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * RemoteBackendTargetCountOutputType without action
   */
  export type RemoteBackendTargetCountOutputTypeCountActiveForUsersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserBackendPreferenceWhereInput
  }


  /**
   * Models
   */

  /**
   * Model User
   */

  export type AggregateUser = {
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  export type UserMinAggregateOutputType = {
    id: string | null
    clerkId: string | null
    email: string | null
    name: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserMaxAggregateOutputType = {
    id: string | null
    clerkId: string | null
    email: string | null
    name: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserCountAggregateOutputType = {
    id: number
    clerkId: number
    email: number
    name: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type UserMinAggregateInputType = {
    id?: true
    clerkId?: true
    email?: true
    name?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserMaxAggregateInputType = {
    id?: true
    clerkId?: true
    email?: true
    name?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserCountAggregateInputType = {
    id?: true
    clerkId?: true
    email?: true
    name?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type UserAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which User to aggregate.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Users
    **/
    _count?: true | UserCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserMaxAggregateInputType
  }

  export type GetUserAggregateType<T extends UserAggregateArgs> = {
        [P in keyof T & keyof AggregateUser]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUser[P]>
      : GetScalarType<T[P], AggregateUser[P]>
  }




  export type UserGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserWhereInput
    orderBy?: UserOrderByWithAggregationInput | UserOrderByWithAggregationInput[]
    by: UserScalarFieldEnum[] | UserScalarFieldEnum
    having?: UserScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserCountAggregateInputType | true
    _min?: UserMinAggregateInputType
    _max?: UserMaxAggregateInputType
  }

  export type UserGroupByOutputType = {
    id: string
    clerkId: string
    email: string
    name: string | null
    createdAt: Date
    updatedAt: Date
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  type GetUserGroupByPayload<T extends UserGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserGroupByOutputType[P]>
            : GetScalarType<T[P], UserGroupByOutputType[P]>
        }
      >
    >


  export type UserSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    clerkId?: boolean
    email?: boolean
    name?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    sshConnections?: boolean | User$sshConnectionsArgs<ExtArgs>
    remoteBackendTargets?: boolean | User$remoteBackendTargetsArgs<ExtArgs>
    backendPreference?: boolean | User$backendPreferenceArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["user"]>

  export type UserSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    clerkId?: boolean
    email?: boolean
    name?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    clerkId?: boolean
    email?: boolean
    name?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectScalar = {
    id?: boolean
    clerkId?: boolean
    email?: boolean
    name?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type UserOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "clerkId" | "email" | "name" | "createdAt" | "updatedAt", ExtArgs["result"]["user"]>
  export type UserInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    sshConnections?: boolean | User$sshConnectionsArgs<ExtArgs>
    remoteBackendTargets?: boolean | User$remoteBackendTargetsArgs<ExtArgs>
    backendPreference?: boolean | User$backendPreferenceArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type UserIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type UserIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $UserPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "User"
    objects: {
      sshConnections: Prisma.$SshConnectionPayload<ExtArgs>[]
      remoteBackendTargets: Prisma.$RemoteBackendTargetPayload<ExtArgs>[]
      backendPreference: Prisma.$UserBackendPreferencePayload<ExtArgs> | null
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      clerkId: string
      email: string
      name: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["user"]>
    composites: {}
  }

  type UserGetPayload<S extends boolean | null | undefined | UserDefaultArgs> = $Result.GetResult<Prisma.$UserPayload, S>

  type UserCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<UserFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: UserCountAggregateInputType | true
    }

  export interface UserDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['User'], meta: { name: 'User' } }
    /**
     * Find zero or one User that matches the filter.
     * @param {UserFindUniqueArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserFindUniqueArgs>(args: SelectSubset<T, UserFindUniqueArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one User that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {UserFindUniqueOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserFindUniqueOrThrowArgs>(args: SelectSubset<T, UserFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserFindFirstArgs>(args?: SelectSubset<T, UserFindFirstArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserFindFirstOrThrowArgs>(args?: SelectSubset<T, UserFindFirstOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Users that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Users
     * const users = await prisma.user.findMany()
     * 
     * // Get first 10 Users
     * const users = await prisma.user.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const userWithIdOnly = await prisma.user.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends UserFindManyArgs>(args?: SelectSubset<T, UserFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a User.
     * @param {UserCreateArgs} args - Arguments to create a User.
     * @example
     * // Create one User
     * const User = await prisma.user.create({
     *   data: {
     *     // ... data to create a User
     *   }
     * })
     * 
     */
    create<T extends UserCreateArgs>(args: SelectSubset<T, UserCreateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Users.
     * @param {UserCreateManyArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UserCreateManyArgs>(args?: SelectSubset<T, UserCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Users and returns the data saved in the database.
     * @param {UserCreateManyAndReturnArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Users and only return the `id`
     * const userWithIdOnly = await prisma.user.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends UserCreateManyAndReturnArgs>(args?: SelectSubset<T, UserCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a User.
     * @param {UserDeleteArgs} args - Arguments to delete one User.
     * @example
     * // Delete one User
     * const User = await prisma.user.delete({
     *   where: {
     *     // ... filter to delete one User
     *   }
     * })
     * 
     */
    delete<T extends UserDeleteArgs>(args: SelectSubset<T, UserDeleteArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one User.
     * @param {UserUpdateArgs} args - Arguments to update one User.
     * @example
     * // Update one User
     * const user = await prisma.user.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UserUpdateArgs>(args: SelectSubset<T, UserUpdateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Users.
     * @param {UserDeleteManyArgs} args - Arguments to filter Users to delete.
     * @example
     * // Delete a few Users
     * const { count } = await prisma.user.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UserDeleteManyArgs>(args?: SelectSubset<T, UserDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UserUpdateManyArgs>(args: SelectSubset<T, UserUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users and returns the data updated in the database.
     * @param {UserUpdateManyAndReturnArgs} args - Arguments to update many Users.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Users and only return the `id`
     * const userWithIdOnly = await prisma.user.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends UserUpdateManyAndReturnArgs>(args: SelectSubset<T, UserUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one User.
     * @param {UserUpsertArgs} args - Arguments to update or create a User.
     * @example
     * // Update or create a User
     * const user = await prisma.user.upsert({
     *   create: {
     *     // ... data to create a User
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the User we want to update
     *   }
     * })
     */
    upsert<T extends UserUpsertArgs>(args: SelectSubset<T, UserUpsertArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserCountArgs} args - Arguments to filter Users to count.
     * @example
     * // Count the number of Users
     * const count = await prisma.user.count({
     *   where: {
     *     // ... the filter for the Users we want to count
     *   }
     * })
    **/
    count<T extends UserCountArgs>(
      args?: Subset<T, UserCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserAggregateArgs>(args: Subset<T, UserAggregateArgs>): Prisma.PrismaPromise<GetUserAggregateType<T>>

    /**
     * Group by User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserGroupByArgs['orderBy'] }
        : { orderBy?: UserGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the User model
   */
  readonly fields: UserFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for User.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    sshConnections<T extends User$sshConnectionsArgs<ExtArgs> = {}>(args?: Subset<T, User$sshConnectionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SshConnectionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    remoteBackendTargets<T extends User$remoteBackendTargetsArgs<ExtArgs> = {}>(args?: Subset<T, User$remoteBackendTargetsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RemoteBackendTargetPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    backendPreference<T extends User$backendPreferenceArgs<ExtArgs> = {}>(args?: Subset<T, User$backendPreferenceArgs<ExtArgs>>): Prisma__UserBackendPreferenceClient<$Result.GetResult<Prisma.$UserBackendPreferencePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the User model
   */
  interface UserFieldRefs {
    readonly id: FieldRef<"User", 'String'>
    readonly clerkId: FieldRef<"User", 'String'>
    readonly email: FieldRef<"User", 'String'>
    readonly name: FieldRef<"User", 'String'>
    readonly createdAt: FieldRef<"User", 'DateTime'>
    readonly updatedAt: FieldRef<"User", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * User findUnique
   */
  export type UserFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findUniqueOrThrow
   */
  export type UserFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findFirst
   */
  export type UserFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findFirstOrThrow
   */
  export type UserFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findMany
   */
  export type UserFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which Users to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User create
   */
  export type UserCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to create a User.
     */
    data: XOR<UserCreateInput, UserUncheckedCreateInput>
  }

  /**
   * User createMany
   */
  export type UserCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User createManyAndReturn
   */
  export type UserCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User update
   */
  export type UserUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to update a User.
     */
    data: XOR<UserUpdateInput, UserUncheckedUpdateInput>
    /**
     * Choose, which User to update.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User updateMany
   */
  export type UserUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User updateManyAndReturn
   */
  export type UserUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User upsert
   */
  export type UserUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The filter to search for the User to update in case it exists.
     */
    where: UserWhereUniqueInput
    /**
     * In case the User found by the `where` argument doesn't exist, create a new User with this data.
     */
    create: XOR<UserCreateInput, UserUncheckedCreateInput>
    /**
     * In case the User was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserUpdateInput, UserUncheckedUpdateInput>
  }

  /**
   * User delete
   */
  export type UserDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter which User to delete.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User deleteMany
   */
  export type UserDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Users to delete
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to delete.
     */
    limit?: number
  }

  /**
   * User.sshConnections
   */
  export type User$sshConnectionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SshConnection
     */
    select?: SshConnectionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SshConnection
     */
    omit?: SshConnectionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SshConnectionInclude<ExtArgs> | null
    where?: SshConnectionWhereInput
    orderBy?: SshConnectionOrderByWithRelationInput | SshConnectionOrderByWithRelationInput[]
    cursor?: SshConnectionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: SshConnectionScalarFieldEnum | SshConnectionScalarFieldEnum[]
  }

  /**
   * User.remoteBackendTargets
   */
  export type User$remoteBackendTargetsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RemoteBackendTarget
     */
    select?: RemoteBackendTargetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RemoteBackendTarget
     */
    omit?: RemoteBackendTargetOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RemoteBackendTargetInclude<ExtArgs> | null
    where?: RemoteBackendTargetWhereInput
    orderBy?: RemoteBackendTargetOrderByWithRelationInput | RemoteBackendTargetOrderByWithRelationInput[]
    cursor?: RemoteBackendTargetWhereUniqueInput
    take?: number
    skip?: number
    distinct?: RemoteBackendTargetScalarFieldEnum | RemoteBackendTargetScalarFieldEnum[]
  }

  /**
   * User.backendPreference
   */
  export type User$backendPreferenceArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserBackendPreference
     */
    select?: UserBackendPreferenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserBackendPreference
     */
    omit?: UserBackendPreferenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserBackendPreferenceInclude<ExtArgs> | null
    where?: UserBackendPreferenceWhereInput
  }

  /**
   * User without action
   */
  export type UserDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
  }


  /**
   * Model SshConnection
   */

  export type AggregateSshConnection = {
    _count: SshConnectionCountAggregateOutputType | null
    _avg: SshConnectionAvgAggregateOutputType | null
    _sum: SshConnectionSumAggregateOutputType | null
    _min: SshConnectionMinAggregateOutputType | null
    _max: SshConnectionMaxAggregateOutputType | null
  }

  export type SshConnectionAvgAggregateOutputType = {
    port: number | null
  }

  export type SshConnectionSumAggregateOutputType = {
    port: number | null
  }

  export type SshConnectionMinAggregateOutputType = {
    id: string | null
    userId: string | null
    name: string | null
    host: string | null
    port: number | null
    username: string | null
    authType: string | null
    encryptedPrivateKey: string | null
    encryptedPassword: string | null
    status: string | null
    os: string | null
    architecture: string | null
    dockerInstalled: boolean | null
    a2rInstalled: boolean | null
    a2rVersion: string | null
    lastConnectedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type SshConnectionMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    name: string | null
    host: string | null
    port: number | null
    username: string | null
    authType: string | null
    encryptedPrivateKey: string | null
    encryptedPassword: string | null
    status: string | null
    os: string | null
    architecture: string | null
    dockerInstalled: boolean | null
    a2rInstalled: boolean | null
    a2rVersion: string | null
    lastConnectedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type SshConnectionCountAggregateOutputType = {
    id: number
    userId: number
    name: number
    host: number
    port: number
    username: number
    authType: number
    encryptedPrivateKey: number
    encryptedPassword: number
    status: number
    os: number
    architecture: number
    dockerInstalled: number
    a2rInstalled: number
    a2rVersion: number
    lastConnectedAt: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type SshConnectionAvgAggregateInputType = {
    port?: true
  }

  export type SshConnectionSumAggregateInputType = {
    port?: true
  }

  export type SshConnectionMinAggregateInputType = {
    id?: true
    userId?: true
    name?: true
    host?: true
    port?: true
    username?: true
    authType?: true
    encryptedPrivateKey?: true
    encryptedPassword?: true
    status?: true
    os?: true
    architecture?: true
    dockerInstalled?: true
    a2rInstalled?: true
    a2rVersion?: true
    lastConnectedAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type SshConnectionMaxAggregateInputType = {
    id?: true
    userId?: true
    name?: true
    host?: true
    port?: true
    username?: true
    authType?: true
    encryptedPrivateKey?: true
    encryptedPassword?: true
    status?: true
    os?: true
    architecture?: true
    dockerInstalled?: true
    a2rInstalled?: true
    a2rVersion?: true
    lastConnectedAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type SshConnectionCountAggregateInputType = {
    id?: true
    userId?: true
    name?: true
    host?: true
    port?: true
    username?: true
    authType?: true
    encryptedPrivateKey?: true
    encryptedPassword?: true
    status?: true
    os?: true
    architecture?: true
    dockerInstalled?: true
    a2rInstalled?: true
    a2rVersion?: true
    lastConnectedAt?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type SshConnectionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which SshConnection to aggregate.
     */
    where?: SshConnectionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SshConnections to fetch.
     */
    orderBy?: SshConnectionOrderByWithRelationInput | SshConnectionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: SshConnectionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SshConnections from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SshConnections.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned SshConnections
    **/
    _count?: true | SshConnectionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: SshConnectionAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: SshConnectionSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: SshConnectionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: SshConnectionMaxAggregateInputType
  }

  export type GetSshConnectionAggregateType<T extends SshConnectionAggregateArgs> = {
        [P in keyof T & keyof AggregateSshConnection]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateSshConnection[P]>
      : GetScalarType<T[P], AggregateSshConnection[P]>
  }




  export type SshConnectionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SshConnectionWhereInput
    orderBy?: SshConnectionOrderByWithAggregationInput | SshConnectionOrderByWithAggregationInput[]
    by: SshConnectionScalarFieldEnum[] | SshConnectionScalarFieldEnum
    having?: SshConnectionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: SshConnectionCountAggregateInputType | true
    _avg?: SshConnectionAvgAggregateInputType
    _sum?: SshConnectionSumAggregateInputType
    _min?: SshConnectionMinAggregateInputType
    _max?: SshConnectionMaxAggregateInputType
  }

  export type SshConnectionGroupByOutputType = {
    id: string
    userId: string
    name: string
    host: string
    port: number
    username: string
    authType: string
    encryptedPrivateKey: string | null
    encryptedPassword: string | null
    status: string
    os: string | null
    architecture: string | null
    dockerInstalled: boolean | null
    a2rInstalled: boolean | null
    a2rVersion: string | null
    lastConnectedAt: Date | null
    createdAt: Date
    updatedAt: Date
    _count: SshConnectionCountAggregateOutputType | null
    _avg: SshConnectionAvgAggregateOutputType | null
    _sum: SshConnectionSumAggregateOutputType | null
    _min: SshConnectionMinAggregateOutputType | null
    _max: SshConnectionMaxAggregateOutputType | null
  }

  type GetSshConnectionGroupByPayload<T extends SshConnectionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<SshConnectionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof SshConnectionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], SshConnectionGroupByOutputType[P]>
            : GetScalarType<T[P], SshConnectionGroupByOutputType[P]>
        }
      >
    >


  export type SshConnectionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    name?: boolean
    host?: boolean
    port?: boolean
    username?: boolean
    authType?: boolean
    encryptedPrivateKey?: boolean
    encryptedPassword?: boolean
    status?: boolean
    os?: boolean
    architecture?: boolean
    dockerInstalled?: boolean
    a2rInstalled?: boolean
    a2rVersion?: boolean
    lastConnectedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    backendTarget?: boolean | SshConnection$backendTargetArgs<ExtArgs>
  }, ExtArgs["result"]["sshConnection"]>

  export type SshConnectionSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    name?: boolean
    host?: boolean
    port?: boolean
    username?: boolean
    authType?: boolean
    encryptedPrivateKey?: boolean
    encryptedPassword?: boolean
    status?: boolean
    os?: boolean
    architecture?: boolean
    dockerInstalled?: boolean
    a2rInstalled?: boolean
    a2rVersion?: boolean
    lastConnectedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["sshConnection"]>

  export type SshConnectionSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    name?: boolean
    host?: boolean
    port?: boolean
    username?: boolean
    authType?: boolean
    encryptedPrivateKey?: boolean
    encryptedPassword?: boolean
    status?: boolean
    os?: boolean
    architecture?: boolean
    dockerInstalled?: boolean
    a2rInstalled?: boolean
    a2rVersion?: boolean
    lastConnectedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["sshConnection"]>

  export type SshConnectionSelectScalar = {
    id?: boolean
    userId?: boolean
    name?: boolean
    host?: boolean
    port?: boolean
    username?: boolean
    authType?: boolean
    encryptedPrivateKey?: boolean
    encryptedPassword?: boolean
    status?: boolean
    os?: boolean
    architecture?: boolean
    dockerInstalled?: boolean
    a2rInstalled?: boolean
    a2rVersion?: boolean
    lastConnectedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type SshConnectionOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "userId" | "name" | "host" | "port" | "username" | "authType" | "encryptedPrivateKey" | "encryptedPassword" | "status" | "os" | "architecture" | "dockerInstalled" | "a2rInstalled" | "a2rVersion" | "lastConnectedAt" | "createdAt" | "updatedAt", ExtArgs["result"]["sshConnection"]>
  export type SshConnectionInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    backendTarget?: boolean | SshConnection$backendTargetArgs<ExtArgs>
  }
  export type SshConnectionIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type SshConnectionIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $SshConnectionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "SshConnection"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
      backendTarget: Prisma.$RemoteBackendTargetPayload<ExtArgs> | null
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId: string
      name: string
      host: string
      port: number
      username: string
      authType: string
      encryptedPrivateKey: string | null
      encryptedPassword: string | null
      status: string
      os: string | null
      architecture: string | null
      dockerInstalled: boolean | null
      a2rInstalled: boolean | null
      a2rVersion: string | null
      lastConnectedAt: Date | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["sshConnection"]>
    composites: {}
  }

  type SshConnectionGetPayload<S extends boolean | null | undefined | SshConnectionDefaultArgs> = $Result.GetResult<Prisma.$SshConnectionPayload, S>

  type SshConnectionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<SshConnectionFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: SshConnectionCountAggregateInputType | true
    }

  export interface SshConnectionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['SshConnection'], meta: { name: 'SshConnection' } }
    /**
     * Find zero or one SshConnection that matches the filter.
     * @param {SshConnectionFindUniqueArgs} args - Arguments to find a SshConnection
     * @example
     * // Get one SshConnection
     * const sshConnection = await prisma.sshConnection.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends SshConnectionFindUniqueArgs>(args: SelectSubset<T, SshConnectionFindUniqueArgs<ExtArgs>>): Prisma__SshConnectionClient<$Result.GetResult<Prisma.$SshConnectionPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one SshConnection that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {SshConnectionFindUniqueOrThrowArgs} args - Arguments to find a SshConnection
     * @example
     * // Get one SshConnection
     * const sshConnection = await prisma.sshConnection.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends SshConnectionFindUniqueOrThrowArgs>(args: SelectSubset<T, SshConnectionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__SshConnectionClient<$Result.GetResult<Prisma.$SshConnectionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first SshConnection that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SshConnectionFindFirstArgs} args - Arguments to find a SshConnection
     * @example
     * // Get one SshConnection
     * const sshConnection = await prisma.sshConnection.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends SshConnectionFindFirstArgs>(args?: SelectSubset<T, SshConnectionFindFirstArgs<ExtArgs>>): Prisma__SshConnectionClient<$Result.GetResult<Prisma.$SshConnectionPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first SshConnection that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SshConnectionFindFirstOrThrowArgs} args - Arguments to find a SshConnection
     * @example
     * // Get one SshConnection
     * const sshConnection = await prisma.sshConnection.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends SshConnectionFindFirstOrThrowArgs>(args?: SelectSubset<T, SshConnectionFindFirstOrThrowArgs<ExtArgs>>): Prisma__SshConnectionClient<$Result.GetResult<Prisma.$SshConnectionPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more SshConnections that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SshConnectionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all SshConnections
     * const sshConnections = await prisma.sshConnection.findMany()
     * 
     * // Get first 10 SshConnections
     * const sshConnections = await prisma.sshConnection.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const sshConnectionWithIdOnly = await prisma.sshConnection.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends SshConnectionFindManyArgs>(args?: SelectSubset<T, SshConnectionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SshConnectionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a SshConnection.
     * @param {SshConnectionCreateArgs} args - Arguments to create a SshConnection.
     * @example
     * // Create one SshConnection
     * const SshConnection = await prisma.sshConnection.create({
     *   data: {
     *     // ... data to create a SshConnection
     *   }
     * })
     * 
     */
    create<T extends SshConnectionCreateArgs>(args: SelectSubset<T, SshConnectionCreateArgs<ExtArgs>>): Prisma__SshConnectionClient<$Result.GetResult<Prisma.$SshConnectionPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many SshConnections.
     * @param {SshConnectionCreateManyArgs} args - Arguments to create many SshConnections.
     * @example
     * // Create many SshConnections
     * const sshConnection = await prisma.sshConnection.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends SshConnectionCreateManyArgs>(args?: SelectSubset<T, SshConnectionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many SshConnections and returns the data saved in the database.
     * @param {SshConnectionCreateManyAndReturnArgs} args - Arguments to create many SshConnections.
     * @example
     * // Create many SshConnections
     * const sshConnection = await prisma.sshConnection.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many SshConnections and only return the `id`
     * const sshConnectionWithIdOnly = await prisma.sshConnection.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends SshConnectionCreateManyAndReturnArgs>(args?: SelectSubset<T, SshConnectionCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SshConnectionPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a SshConnection.
     * @param {SshConnectionDeleteArgs} args - Arguments to delete one SshConnection.
     * @example
     * // Delete one SshConnection
     * const SshConnection = await prisma.sshConnection.delete({
     *   where: {
     *     // ... filter to delete one SshConnection
     *   }
     * })
     * 
     */
    delete<T extends SshConnectionDeleteArgs>(args: SelectSubset<T, SshConnectionDeleteArgs<ExtArgs>>): Prisma__SshConnectionClient<$Result.GetResult<Prisma.$SshConnectionPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one SshConnection.
     * @param {SshConnectionUpdateArgs} args - Arguments to update one SshConnection.
     * @example
     * // Update one SshConnection
     * const sshConnection = await prisma.sshConnection.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends SshConnectionUpdateArgs>(args: SelectSubset<T, SshConnectionUpdateArgs<ExtArgs>>): Prisma__SshConnectionClient<$Result.GetResult<Prisma.$SshConnectionPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more SshConnections.
     * @param {SshConnectionDeleteManyArgs} args - Arguments to filter SshConnections to delete.
     * @example
     * // Delete a few SshConnections
     * const { count } = await prisma.sshConnection.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends SshConnectionDeleteManyArgs>(args?: SelectSubset<T, SshConnectionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more SshConnections.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SshConnectionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many SshConnections
     * const sshConnection = await prisma.sshConnection.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends SshConnectionUpdateManyArgs>(args: SelectSubset<T, SshConnectionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more SshConnections and returns the data updated in the database.
     * @param {SshConnectionUpdateManyAndReturnArgs} args - Arguments to update many SshConnections.
     * @example
     * // Update many SshConnections
     * const sshConnection = await prisma.sshConnection.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more SshConnections and only return the `id`
     * const sshConnectionWithIdOnly = await prisma.sshConnection.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends SshConnectionUpdateManyAndReturnArgs>(args: SelectSubset<T, SshConnectionUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SshConnectionPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one SshConnection.
     * @param {SshConnectionUpsertArgs} args - Arguments to update or create a SshConnection.
     * @example
     * // Update or create a SshConnection
     * const sshConnection = await prisma.sshConnection.upsert({
     *   create: {
     *     // ... data to create a SshConnection
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the SshConnection we want to update
     *   }
     * })
     */
    upsert<T extends SshConnectionUpsertArgs>(args: SelectSubset<T, SshConnectionUpsertArgs<ExtArgs>>): Prisma__SshConnectionClient<$Result.GetResult<Prisma.$SshConnectionPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of SshConnections.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SshConnectionCountArgs} args - Arguments to filter SshConnections to count.
     * @example
     * // Count the number of SshConnections
     * const count = await prisma.sshConnection.count({
     *   where: {
     *     // ... the filter for the SshConnections we want to count
     *   }
     * })
    **/
    count<T extends SshConnectionCountArgs>(
      args?: Subset<T, SshConnectionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], SshConnectionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a SshConnection.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SshConnectionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends SshConnectionAggregateArgs>(args: Subset<T, SshConnectionAggregateArgs>): Prisma.PrismaPromise<GetSshConnectionAggregateType<T>>

    /**
     * Group by SshConnection.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SshConnectionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends SshConnectionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: SshConnectionGroupByArgs['orderBy'] }
        : { orderBy?: SshConnectionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, SshConnectionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetSshConnectionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the SshConnection model
   */
  readonly fields: SshConnectionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for SshConnection.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__SshConnectionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    backendTarget<T extends SshConnection$backendTargetArgs<ExtArgs> = {}>(args?: Subset<T, SshConnection$backendTargetArgs<ExtArgs>>): Prisma__RemoteBackendTargetClient<$Result.GetResult<Prisma.$RemoteBackendTargetPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the SshConnection model
   */
  interface SshConnectionFieldRefs {
    readonly id: FieldRef<"SshConnection", 'String'>
    readonly userId: FieldRef<"SshConnection", 'String'>
    readonly name: FieldRef<"SshConnection", 'String'>
    readonly host: FieldRef<"SshConnection", 'String'>
    readonly port: FieldRef<"SshConnection", 'Int'>
    readonly username: FieldRef<"SshConnection", 'String'>
    readonly authType: FieldRef<"SshConnection", 'String'>
    readonly encryptedPrivateKey: FieldRef<"SshConnection", 'String'>
    readonly encryptedPassword: FieldRef<"SshConnection", 'String'>
    readonly status: FieldRef<"SshConnection", 'String'>
    readonly os: FieldRef<"SshConnection", 'String'>
    readonly architecture: FieldRef<"SshConnection", 'String'>
    readonly dockerInstalled: FieldRef<"SshConnection", 'Boolean'>
    readonly a2rInstalled: FieldRef<"SshConnection", 'Boolean'>
    readonly a2rVersion: FieldRef<"SshConnection", 'String'>
    readonly lastConnectedAt: FieldRef<"SshConnection", 'DateTime'>
    readonly createdAt: FieldRef<"SshConnection", 'DateTime'>
    readonly updatedAt: FieldRef<"SshConnection", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * SshConnection findUnique
   */
  export type SshConnectionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SshConnection
     */
    select?: SshConnectionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SshConnection
     */
    omit?: SshConnectionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SshConnectionInclude<ExtArgs> | null
    /**
     * Filter, which SshConnection to fetch.
     */
    where: SshConnectionWhereUniqueInput
  }

  /**
   * SshConnection findUniqueOrThrow
   */
  export type SshConnectionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SshConnection
     */
    select?: SshConnectionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SshConnection
     */
    omit?: SshConnectionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SshConnectionInclude<ExtArgs> | null
    /**
     * Filter, which SshConnection to fetch.
     */
    where: SshConnectionWhereUniqueInput
  }

  /**
   * SshConnection findFirst
   */
  export type SshConnectionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SshConnection
     */
    select?: SshConnectionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SshConnection
     */
    omit?: SshConnectionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SshConnectionInclude<ExtArgs> | null
    /**
     * Filter, which SshConnection to fetch.
     */
    where?: SshConnectionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SshConnections to fetch.
     */
    orderBy?: SshConnectionOrderByWithRelationInput | SshConnectionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for SshConnections.
     */
    cursor?: SshConnectionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SshConnections from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SshConnections.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SshConnections.
     */
    distinct?: SshConnectionScalarFieldEnum | SshConnectionScalarFieldEnum[]
  }

  /**
   * SshConnection findFirstOrThrow
   */
  export type SshConnectionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SshConnection
     */
    select?: SshConnectionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SshConnection
     */
    omit?: SshConnectionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SshConnectionInclude<ExtArgs> | null
    /**
     * Filter, which SshConnection to fetch.
     */
    where?: SshConnectionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SshConnections to fetch.
     */
    orderBy?: SshConnectionOrderByWithRelationInput | SshConnectionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for SshConnections.
     */
    cursor?: SshConnectionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SshConnections from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SshConnections.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SshConnections.
     */
    distinct?: SshConnectionScalarFieldEnum | SshConnectionScalarFieldEnum[]
  }

  /**
   * SshConnection findMany
   */
  export type SshConnectionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SshConnection
     */
    select?: SshConnectionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SshConnection
     */
    omit?: SshConnectionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SshConnectionInclude<ExtArgs> | null
    /**
     * Filter, which SshConnections to fetch.
     */
    where?: SshConnectionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SshConnections to fetch.
     */
    orderBy?: SshConnectionOrderByWithRelationInput | SshConnectionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing SshConnections.
     */
    cursor?: SshConnectionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SshConnections from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SshConnections.
     */
    skip?: number
    distinct?: SshConnectionScalarFieldEnum | SshConnectionScalarFieldEnum[]
  }

  /**
   * SshConnection create
   */
  export type SshConnectionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SshConnection
     */
    select?: SshConnectionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SshConnection
     */
    omit?: SshConnectionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SshConnectionInclude<ExtArgs> | null
    /**
     * The data needed to create a SshConnection.
     */
    data: XOR<SshConnectionCreateInput, SshConnectionUncheckedCreateInput>
  }

  /**
   * SshConnection createMany
   */
  export type SshConnectionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many SshConnections.
     */
    data: SshConnectionCreateManyInput | SshConnectionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * SshConnection createManyAndReturn
   */
  export type SshConnectionCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SshConnection
     */
    select?: SshConnectionSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the SshConnection
     */
    omit?: SshConnectionOmit<ExtArgs> | null
    /**
     * The data used to create many SshConnections.
     */
    data: SshConnectionCreateManyInput | SshConnectionCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SshConnectionIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * SshConnection update
   */
  export type SshConnectionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SshConnection
     */
    select?: SshConnectionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SshConnection
     */
    omit?: SshConnectionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SshConnectionInclude<ExtArgs> | null
    /**
     * The data needed to update a SshConnection.
     */
    data: XOR<SshConnectionUpdateInput, SshConnectionUncheckedUpdateInput>
    /**
     * Choose, which SshConnection to update.
     */
    where: SshConnectionWhereUniqueInput
  }

  /**
   * SshConnection updateMany
   */
  export type SshConnectionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update SshConnections.
     */
    data: XOR<SshConnectionUpdateManyMutationInput, SshConnectionUncheckedUpdateManyInput>
    /**
     * Filter which SshConnections to update
     */
    where?: SshConnectionWhereInput
    /**
     * Limit how many SshConnections to update.
     */
    limit?: number
  }

  /**
   * SshConnection updateManyAndReturn
   */
  export type SshConnectionUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SshConnection
     */
    select?: SshConnectionSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the SshConnection
     */
    omit?: SshConnectionOmit<ExtArgs> | null
    /**
     * The data used to update SshConnections.
     */
    data: XOR<SshConnectionUpdateManyMutationInput, SshConnectionUncheckedUpdateManyInput>
    /**
     * Filter which SshConnections to update
     */
    where?: SshConnectionWhereInput
    /**
     * Limit how many SshConnections to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SshConnectionIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * SshConnection upsert
   */
  export type SshConnectionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SshConnection
     */
    select?: SshConnectionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SshConnection
     */
    omit?: SshConnectionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SshConnectionInclude<ExtArgs> | null
    /**
     * The filter to search for the SshConnection to update in case it exists.
     */
    where: SshConnectionWhereUniqueInput
    /**
     * In case the SshConnection found by the `where` argument doesn't exist, create a new SshConnection with this data.
     */
    create: XOR<SshConnectionCreateInput, SshConnectionUncheckedCreateInput>
    /**
     * In case the SshConnection was found with the provided `where` argument, update it with this data.
     */
    update: XOR<SshConnectionUpdateInput, SshConnectionUncheckedUpdateInput>
  }

  /**
   * SshConnection delete
   */
  export type SshConnectionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SshConnection
     */
    select?: SshConnectionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SshConnection
     */
    omit?: SshConnectionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SshConnectionInclude<ExtArgs> | null
    /**
     * Filter which SshConnection to delete.
     */
    where: SshConnectionWhereUniqueInput
  }

  /**
   * SshConnection deleteMany
   */
  export type SshConnectionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which SshConnections to delete
     */
    where?: SshConnectionWhereInput
    /**
     * Limit how many SshConnections to delete.
     */
    limit?: number
  }

  /**
   * SshConnection.backendTarget
   */
  export type SshConnection$backendTargetArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RemoteBackendTarget
     */
    select?: RemoteBackendTargetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RemoteBackendTarget
     */
    omit?: RemoteBackendTargetOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RemoteBackendTargetInclude<ExtArgs> | null
    where?: RemoteBackendTargetWhereInput
  }

  /**
   * SshConnection without action
   */
  export type SshConnectionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SshConnection
     */
    select?: SshConnectionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SshConnection
     */
    omit?: SshConnectionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SshConnectionInclude<ExtArgs> | null
  }


  /**
   * Model RemoteBackendTarget
   */

  export type AggregateRemoteBackendTarget = {
    _count: RemoteBackendTargetCountAggregateOutputType | null
    _min: RemoteBackendTargetMinAggregateOutputType | null
    _max: RemoteBackendTargetMaxAggregateOutputType | null
  }

  export type RemoteBackendTargetMinAggregateOutputType = {
    id: string | null
    userId: string | null
    sshConnectionId: string | null
    name: string | null
    status: string | null
    installState: string | null
    backendUrl: string | null
    gatewayUrl: string | null
    gatewayWsUrl: string | null
    encryptedGatewayToken: string | null
    installedVersion: string | null
    supportedClientRange: string | null
    lastVerifiedAt: Date | null
    lastHeartbeatAt: Date | null
    lastError: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type RemoteBackendTargetMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    sshConnectionId: string | null
    name: string | null
    status: string | null
    installState: string | null
    backendUrl: string | null
    gatewayUrl: string | null
    gatewayWsUrl: string | null
    encryptedGatewayToken: string | null
    installedVersion: string | null
    supportedClientRange: string | null
    lastVerifiedAt: Date | null
    lastHeartbeatAt: Date | null
    lastError: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type RemoteBackendTargetCountAggregateOutputType = {
    id: number
    userId: number
    sshConnectionId: number
    name: number
    status: number
    installState: number
    backendUrl: number
    gatewayUrl: number
    gatewayWsUrl: number
    encryptedGatewayToken: number
    installedVersion: number
    supportedClientRange: number
    lastVerifiedAt: number
    lastHeartbeatAt: number
    lastError: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type RemoteBackendTargetMinAggregateInputType = {
    id?: true
    userId?: true
    sshConnectionId?: true
    name?: true
    status?: true
    installState?: true
    backendUrl?: true
    gatewayUrl?: true
    gatewayWsUrl?: true
    encryptedGatewayToken?: true
    installedVersion?: true
    supportedClientRange?: true
    lastVerifiedAt?: true
    lastHeartbeatAt?: true
    lastError?: true
    createdAt?: true
    updatedAt?: true
  }

  export type RemoteBackendTargetMaxAggregateInputType = {
    id?: true
    userId?: true
    sshConnectionId?: true
    name?: true
    status?: true
    installState?: true
    backendUrl?: true
    gatewayUrl?: true
    gatewayWsUrl?: true
    encryptedGatewayToken?: true
    installedVersion?: true
    supportedClientRange?: true
    lastVerifiedAt?: true
    lastHeartbeatAt?: true
    lastError?: true
    createdAt?: true
    updatedAt?: true
  }

  export type RemoteBackendTargetCountAggregateInputType = {
    id?: true
    userId?: true
    sshConnectionId?: true
    name?: true
    status?: true
    installState?: true
    backendUrl?: true
    gatewayUrl?: true
    gatewayWsUrl?: true
    encryptedGatewayToken?: true
    installedVersion?: true
    supportedClientRange?: true
    lastVerifiedAt?: true
    lastHeartbeatAt?: true
    lastError?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type RemoteBackendTargetAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which RemoteBackendTarget to aggregate.
     */
    where?: RemoteBackendTargetWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RemoteBackendTargets to fetch.
     */
    orderBy?: RemoteBackendTargetOrderByWithRelationInput | RemoteBackendTargetOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: RemoteBackendTargetWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RemoteBackendTargets from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RemoteBackendTargets.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned RemoteBackendTargets
    **/
    _count?: true | RemoteBackendTargetCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: RemoteBackendTargetMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: RemoteBackendTargetMaxAggregateInputType
  }

  export type GetRemoteBackendTargetAggregateType<T extends RemoteBackendTargetAggregateArgs> = {
        [P in keyof T & keyof AggregateRemoteBackendTarget]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateRemoteBackendTarget[P]>
      : GetScalarType<T[P], AggregateRemoteBackendTarget[P]>
  }




  export type RemoteBackendTargetGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: RemoteBackendTargetWhereInput
    orderBy?: RemoteBackendTargetOrderByWithAggregationInput | RemoteBackendTargetOrderByWithAggregationInput[]
    by: RemoteBackendTargetScalarFieldEnum[] | RemoteBackendTargetScalarFieldEnum
    having?: RemoteBackendTargetScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: RemoteBackendTargetCountAggregateInputType | true
    _min?: RemoteBackendTargetMinAggregateInputType
    _max?: RemoteBackendTargetMaxAggregateInputType
  }

  export type RemoteBackendTargetGroupByOutputType = {
    id: string
    userId: string
    sshConnectionId: string
    name: string
    status: string
    installState: string
    backendUrl: string | null
    gatewayUrl: string | null
    gatewayWsUrl: string | null
    encryptedGatewayToken: string | null
    installedVersion: string | null
    supportedClientRange: string | null
    lastVerifiedAt: Date | null
    lastHeartbeatAt: Date | null
    lastError: string | null
    createdAt: Date
    updatedAt: Date
    _count: RemoteBackendTargetCountAggregateOutputType | null
    _min: RemoteBackendTargetMinAggregateOutputType | null
    _max: RemoteBackendTargetMaxAggregateOutputType | null
  }

  type GetRemoteBackendTargetGroupByPayload<T extends RemoteBackendTargetGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<RemoteBackendTargetGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof RemoteBackendTargetGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], RemoteBackendTargetGroupByOutputType[P]>
            : GetScalarType<T[P], RemoteBackendTargetGroupByOutputType[P]>
        }
      >
    >


  export type RemoteBackendTargetSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    sshConnectionId?: boolean
    name?: boolean
    status?: boolean
    installState?: boolean
    backendUrl?: boolean
    gatewayUrl?: boolean
    gatewayWsUrl?: boolean
    encryptedGatewayToken?: boolean
    installedVersion?: boolean
    supportedClientRange?: boolean
    lastVerifiedAt?: boolean
    lastHeartbeatAt?: boolean
    lastError?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    sshConnection?: boolean | SshConnectionDefaultArgs<ExtArgs>
    activeForUsers?: boolean | RemoteBackendTarget$activeForUsersArgs<ExtArgs>
    _count?: boolean | RemoteBackendTargetCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["remoteBackendTarget"]>

  export type RemoteBackendTargetSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    sshConnectionId?: boolean
    name?: boolean
    status?: boolean
    installState?: boolean
    backendUrl?: boolean
    gatewayUrl?: boolean
    gatewayWsUrl?: boolean
    encryptedGatewayToken?: boolean
    installedVersion?: boolean
    supportedClientRange?: boolean
    lastVerifiedAt?: boolean
    lastHeartbeatAt?: boolean
    lastError?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    sshConnection?: boolean | SshConnectionDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["remoteBackendTarget"]>

  export type RemoteBackendTargetSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    sshConnectionId?: boolean
    name?: boolean
    status?: boolean
    installState?: boolean
    backendUrl?: boolean
    gatewayUrl?: boolean
    gatewayWsUrl?: boolean
    encryptedGatewayToken?: boolean
    installedVersion?: boolean
    supportedClientRange?: boolean
    lastVerifiedAt?: boolean
    lastHeartbeatAt?: boolean
    lastError?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    sshConnection?: boolean | SshConnectionDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["remoteBackendTarget"]>

  export type RemoteBackendTargetSelectScalar = {
    id?: boolean
    userId?: boolean
    sshConnectionId?: boolean
    name?: boolean
    status?: boolean
    installState?: boolean
    backendUrl?: boolean
    gatewayUrl?: boolean
    gatewayWsUrl?: boolean
    encryptedGatewayToken?: boolean
    installedVersion?: boolean
    supportedClientRange?: boolean
    lastVerifiedAt?: boolean
    lastHeartbeatAt?: boolean
    lastError?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type RemoteBackendTargetOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "userId" | "sshConnectionId" | "name" | "status" | "installState" | "backendUrl" | "gatewayUrl" | "gatewayWsUrl" | "encryptedGatewayToken" | "installedVersion" | "supportedClientRange" | "lastVerifiedAt" | "lastHeartbeatAt" | "lastError" | "createdAt" | "updatedAt", ExtArgs["result"]["remoteBackendTarget"]>
  export type RemoteBackendTargetInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    sshConnection?: boolean | SshConnectionDefaultArgs<ExtArgs>
    activeForUsers?: boolean | RemoteBackendTarget$activeForUsersArgs<ExtArgs>
    _count?: boolean | RemoteBackendTargetCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type RemoteBackendTargetIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    sshConnection?: boolean | SshConnectionDefaultArgs<ExtArgs>
  }
  export type RemoteBackendTargetIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    sshConnection?: boolean | SshConnectionDefaultArgs<ExtArgs>
  }

  export type $RemoteBackendTargetPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "RemoteBackendTarget"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
      sshConnection: Prisma.$SshConnectionPayload<ExtArgs>
      activeForUsers: Prisma.$UserBackendPreferencePayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId: string
      sshConnectionId: string
      name: string
      status: string
      installState: string
      backendUrl: string | null
      gatewayUrl: string | null
      gatewayWsUrl: string | null
      encryptedGatewayToken: string | null
      installedVersion: string | null
      supportedClientRange: string | null
      lastVerifiedAt: Date | null
      lastHeartbeatAt: Date | null
      lastError: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["remoteBackendTarget"]>
    composites: {}
  }

  type RemoteBackendTargetGetPayload<S extends boolean | null | undefined | RemoteBackendTargetDefaultArgs> = $Result.GetResult<Prisma.$RemoteBackendTargetPayload, S>

  type RemoteBackendTargetCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<RemoteBackendTargetFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: RemoteBackendTargetCountAggregateInputType | true
    }

  export interface RemoteBackendTargetDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['RemoteBackendTarget'], meta: { name: 'RemoteBackendTarget' } }
    /**
     * Find zero or one RemoteBackendTarget that matches the filter.
     * @param {RemoteBackendTargetFindUniqueArgs} args - Arguments to find a RemoteBackendTarget
     * @example
     * // Get one RemoteBackendTarget
     * const remoteBackendTarget = await prisma.remoteBackendTarget.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends RemoteBackendTargetFindUniqueArgs>(args: SelectSubset<T, RemoteBackendTargetFindUniqueArgs<ExtArgs>>): Prisma__RemoteBackendTargetClient<$Result.GetResult<Prisma.$RemoteBackendTargetPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one RemoteBackendTarget that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {RemoteBackendTargetFindUniqueOrThrowArgs} args - Arguments to find a RemoteBackendTarget
     * @example
     * // Get one RemoteBackendTarget
     * const remoteBackendTarget = await prisma.remoteBackendTarget.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends RemoteBackendTargetFindUniqueOrThrowArgs>(args: SelectSubset<T, RemoteBackendTargetFindUniqueOrThrowArgs<ExtArgs>>): Prisma__RemoteBackendTargetClient<$Result.GetResult<Prisma.$RemoteBackendTargetPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first RemoteBackendTarget that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RemoteBackendTargetFindFirstArgs} args - Arguments to find a RemoteBackendTarget
     * @example
     * // Get one RemoteBackendTarget
     * const remoteBackendTarget = await prisma.remoteBackendTarget.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends RemoteBackendTargetFindFirstArgs>(args?: SelectSubset<T, RemoteBackendTargetFindFirstArgs<ExtArgs>>): Prisma__RemoteBackendTargetClient<$Result.GetResult<Prisma.$RemoteBackendTargetPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first RemoteBackendTarget that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RemoteBackendTargetFindFirstOrThrowArgs} args - Arguments to find a RemoteBackendTarget
     * @example
     * // Get one RemoteBackendTarget
     * const remoteBackendTarget = await prisma.remoteBackendTarget.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends RemoteBackendTargetFindFirstOrThrowArgs>(args?: SelectSubset<T, RemoteBackendTargetFindFirstOrThrowArgs<ExtArgs>>): Prisma__RemoteBackendTargetClient<$Result.GetResult<Prisma.$RemoteBackendTargetPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more RemoteBackendTargets that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RemoteBackendTargetFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all RemoteBackendTargets
     * const remoteBackendTargets = await prisma.remoteBackendTarget.findMany()
     * 
     * // Get first 10 RemoteBackendTargets
     * const remoteBackendTargets = await prisma.remoteBackendTarget.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const remoteBackendTargetWithIdOnly = await prisma.remoteBackendTarget.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends RemoteBackendTargetFindManyArgs>(args?: SelectSubset<T, RemoteBackendTargetFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RemoteBackendTargetPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a RemoteBackendTarget.
     * @param {RemoteBackendTargetCreateArgs} args - Arguments to create a RemoteBackendTarget.
     * @example
     * // Create one RemoteBackendTarget
     * const RemoteBackendTarget = await prisma.remoteBackendTarget.create({
     *   data: {
     *     // ... data to create a RemoteBackendTarget
     *   }
     * })
     * 
     */
    create<T extends RemoteBackendTargetCreateArgs>(args: SelectSubset<T, RemoteBackendTargetCreateArgs<ExtArgs>>): Prisma__RemoteBackendTargetClient<$Result.GetResult<Prisma.$RemoteBackendTargetPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many RemoteBackendTargets.
     * @param {RemoteBackendTargetCreateManyArgs} args - Arguments to create many RemoteBackendTargets.
     * @example
     * // Create many RemoteBackendTargets
     * const remoteBackendTarget = await prisma.remoteBackendTarget.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends RemoteBackendTargetCreateManyArgs>(args?: SelectSubset<T, RemoteBackendTargetCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many RemoteBackendTargets and returns the data saved in the database.
     * @param {RemoteBackendTargetCreateManyAndReturnArgs} args - Arguments to create many RemoteBackendTargets.
     * @example
     * // Create many RemoteBackendTargets
     * const remoteBackendTarget = await prisma.remoteBackendTarget.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many RemoteBackendTargets and only return the `id`
     * const remoteBackendTargetWithIdOnly = await prisma.remoteBackendTarget.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends RemoteBackendTargetCreateManyAndReturnArgs>(args?: SelectSubset<T, RemoteBackendTargetCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RemoteBackendTargetPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a RemoteBackendTarget.
     * @param {RemoteBackendTargetDeleteArgs} args - Arguments to delete one RemoteBackendTarget.
     * @example
     * // Delete one RemoteBackendTarget
     * const RemoteBackendTarget = await prisma.remoteBackendTarget.delete({
     *   where: {
     *     // ... filter to delete one RemoteBackendTarget
     *   }
     * })
     * 
     */
    delete<T extends RemoteBackendTargetDeleteArgs>(args: SelectSubset<T, RemoteBackendTargetDeleteArgs<ExtArgs>>): Prisma__RemoteBackendTargetClient<$Result.GetResult<Prisma.$RemoteBackendTargetPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one RemoteBackendTarget.
     * @param {RemoteBackendTargetUpdateArgs} args - Arguments to update one RemoteBackendTarget.
     * @example
     * // Update one RemoteBackendTarget
     * const remoteBackendTarget = await prisma.remoteBackendTarget.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends RemoteBackendTargetUpdateArgs>(args: SelectSubset<T, RemoteBackendTargetUpdateArgs<ExtArgs>>): Prisma__RemoteBackendTargetClient<$Result.GetResult<Prisma.$RemoteBackendTargetPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more RemoteBackendTargets.
     * @param {RemoteBackendTargetDeleteManyArgs} args - Arguments to filter RemoteBackendTargets to delete.
     * @example
     * // Delete a few RemoteBackendTargets
     * const { count } = await prisma.remoteBackendTarget.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends RemoteBackendTargetDeleteManyArgs>(args?: SelectSubset<T, RemoteBackendTargetDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more RemoteBackendTargets.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RemoteBackendTargetUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many RemoteBackendTargets
     * const remoteBackendTarget = await prisma.remoteBackendTarget.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends RemoteBackendTargetUpdateManyArgs>(args: SelectSubset<T, RemoteBackendTargetUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more RemoteBackendTargets and returns the data updated in the database.
     * @param {RemoteBackendTargetUpdateManyAndReturnArgs} args - Arguments to update many RemoteBackendTargets.
     * @example
     * // Update many RemoteBackendTargets
     * const remoteBackendTarget = await prisma.remoteBackendTarget.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more RemoteBackendTargets and only return the `id`
     * const remoteBackendTargetWithIdOnly = await prisma.remoteBackendTarget.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends RemoteBackendTargetUpdateManyAndReturnArgs>(args: SelectSubset<T, RemoteBackendTargetUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RemoteBackendTargetPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one RemoteBackendTarget.
     * @param {RemoteBackendTargetUpsertArgs} args - Arguments to update or create a RemoteBackendTarget.
     * @example
     * // Update or create a RemoteBackendTarget
     * const remoteBackendTarget = await prisma.remoteBackendTarget.upsert({
     *   create: {
     *     // ... data to create a RemoteBackendTarget
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the RemoteBackendTarget we want to update
     *   }
     * })
     */
    upsert<T extends RemoteBackendTargetUpsertArgs>(args: SelectSubset<T, RemoteBackendTargetUpsertArgs<ExtArgs>>): Prisma__RemoteBackendTargetClient<$Result.GetResult<Prisma.$RemoteBackendTargetPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of RemoteBackendTargets.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RemoteBackendTargetCountArgs} args - Arguments to filter RemoteBackendTargets to count.
     * @example
     * // Count the number of RemoteBackendTargets
     * const count = await prisma.remoteBackendTarget.count({
     *   where: {
     *     // ... the filter for the RemoteBackendTargets we want to count
     *   }
     * })
    **/
    count<T extends RemoteBackendTargetCountArgs>(
      args?: Subset<T, RemoteBackendTargetCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], RemoteBackendTargetCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a RemoteBackendTarget.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RemoteBackendTargetAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends RemoteBackendTargetAggregateArgs>(args: Subset<T, RemoteBackendTargetAggregateArgs>): Prisma.PrismaPromise<GetRemoteBackendTargetAggregateType<T>>

    /**
     * Group by RemoteBackendTarget.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RemoteBackendTargetGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends RemoteBackendTargetGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: RemoteBackendTargetGroupByArgs['orderBy'] }
        : { orderBy?: RemoteBackendTargetGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, RemoteBackendTargetGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetRemoteBackendTargetGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the RemoteBackendTarget model
   */
  readonly fields: RemoteBackendTargetFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for RemoteBackendTarget.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__RemoteBackendTargetClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    sshConnection<T extends SshConnectionDefaultArgs<ExtArgs> = {}>(args?: Subset<T, SshConnectionDefaultArgs<ExtArgs>>): Prisma__SshConnectionClient<$Result.GetResult<Prisma.$SshConnectionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    activeForUsers<T extends RemoteBackendTarget$activeForUsersArgs<ExtArgs> = {}>(args?: Subset<T, RemoteBackendTarget$activeForUsersArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserBackendPreferencePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the RemoteBackendTarget model
   */
  interface RemoteBackendTargetFieldRefs {
    readonly id: FieldRef<"RemoteBackendTarget", 'String'>
    readonly userId: FieldRef<"RemoteBackendTarget", 'String'>
    readonly sshConnectionId: FieldRef<"RemoteBackendTarget", 'String'>
    readonly name: FieldRef<"RemoteBackendTarget", 'String'>
    readonly status: FieldRef<"RemoteBackendTarget", 'String'>
    readonly installState: FieldRef<"RemoteBackendTarget", 'String'>
    readonly backendUrl: FieldRef<"RemoteBackendTarget", 'String'>
    readonly gatewayUrl: FieldRef<"RemoteBackendTarget", 'String'>
    readonly gatewayWsUrl: FieldRef<"RemoteBackendTarget", 'String'>
    readonly encryptedGatewayToken: FieldRef<"RemoteBackendTarget", 'String'>
    readonly installedVersion: FieldRef<"RemoteBackendTarget", 'String'>
    readonly supportedClientRange: FieldRef<"RemoteBackendTarget", 'String'>
    readonly lastVerifiedAt: FieldRef<"RemoteBackendTarget", 'DateTime'>
    readonly lastHeartbeatAt: FieldRef<"RemoteBackendTarget", 'DateTime'>
    readonly lastError: FieldRef<"RemoteBackendTarget", 'String'>
    readonly createdAt: FieldRef<"RemoteBackendTarget", 'DateTime'>
    readonly updatedAt: FieldRef<"RemoteBackendTarget", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * RemoteBackendTarget findUnique
   */
  export type RemoteBackendTargetFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RemoteBackendTarget
     */
    select?: RemoteBackendTargetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RemoteBackendTarget
     */
    omit?: RemoteBackendTargetOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RemoteBackendTargetInclude<ExtArgs> | null
    /**
     * Filter, which RemoteBackendTarget to fetch.
     */
    where: RemoteBackendTargetWhereUniqueInput
  }

  /**
   * RemoteBackendTarget findUniqueOrThrow
   */
  export type RemoteBackendTargetFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RemoteBackendTarget
     */
    select?: RemoteBackendTargetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RemoteBackendTarget
     */
    omit?: RemoteBackendTargetOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RemoteBackendTargetInclude<ExtArgs> | null
    /**
     * Filter, which RemoteBackendTarget to fetch.
     */
    where: RemoteBackendTargetWhereUniqueInput
  }

  /**
   * RemoteBackendTarget findFirst
   */
  export type RemoteBackendTargetFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RemoteBackendTarget
     */
    select?: RemoteBackendTargetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RemoteBackendTarget
     */
    omit?: RemoteBackendTargetOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RemoteBackendTargetInclude<ExtArgs> | null
    /**
     * Filter, which RemoteBackendTarget to fetch.
     */
    where?: RemoteBackendTargetWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RemoteBackendTargets to fetch.
     */
    orderBy?: RemoteBackendTargetOrderByWithRelationInput | RemoteBackendTargetOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for RemoteBackendTargets.
     */
    cursor?: RemoteBackendTargetWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RemoteBackendTargets from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RemoteBackendTargets.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of RemoteBackendTargets.
     */
    distinct?: RemoteBackendTargetScalarFieldEnum | RemoteBackendTargetScalarFieldEnum[]
  }

  /**
   * RemoteBackendTarget findFirstOrThrow
   */
  export type RemoteBackendTargetFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RemoteBackendTarget
     */
    select?: RemoteBackendTargetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RemoteBackendTarget
     */
    omit?: RemoteBackendTargetOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RemoteBackendTargetInclude<ExtArgs> | null
    /**
     * Filter, which RemoteBackendTarget to fetch.
     */
    where?: RemoteBackendTargetWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RemoteBackendTargets to fetch.
     */
    orderBy?: RemoteBackendTargetOrderByWithRelationInput | RemoteBackendTargetOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for RemoteBackendTargets.
     */
    cursor?: RemoteBackendTargetWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RemoteBackendTargets from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RemoteBackendTargets.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of RemoteBackendTargets.
     */
    distinct?: RemoteBackendTargetScalarFieldEnum | RemoteBackendTargetScalarFieldEnum[]
  }

  /**
   * RemoteBackendTarget findMany
   */
  export type RemoteBackendTargetFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RemoteBackendTarget
     */
    select?: RemoteBackendTargetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RemoteBackendTarget
     */
    omit?: RemoteBackendTargetOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RemoteBackendTargetInclude<ExtArgs> | null
    /**
     * Filter, which RemoteBackendTargets to fetch.
     */
    where?: RemoteBackendTargetWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RemoteBackendTargets to fetch.
     */
    orderBy?: RemoteBackendTargetOrderByWithRelationInput | RemoteBackendTargetOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing RemoteBackendTargets.
     */
    cursor?: RemoteBackendTargetWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RemoteBackendTargets from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RemoteBackendTargets.
     */
    skip?: number
    distinct?: RemoteBackendTargetScalarFieldEnum | RemoteBackendTargetScalarFieldEnum[]
  }

  /**
   * RemoteBackendTarget create
   */
  export type RemoteBackendTargetCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RemoteBackendTarget
     */
    select?: RemoteBackendTargetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RemoteBackendTarget
     */
    omit?: RemoteBackendTargetOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RemoteBackendTargetInclude<ExtArgs> | null
    /**
     * The data needed to create a RemoteBackendTarget.
     */
    data: XOR<RemoteBackendTargetCreateInput, RemoteBackendTargetUncheckedCreateInput>
  }

  /**
   * RemoteBackendTarget createMany
   */
  export type RemoteBackendTargetCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many RemoteBackendTargets.
     */
    data: RemoteBackendTargetCreateManyInput | RemoteBackendTargetCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * RemoteBackendTarget createManyAndReturn
   */
  export type RemoteBackendTargetCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RemoteBackendTarget
     */
    select?: RemoteBackendTargetSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the RemoteBackendTarget
     */
    omit?: RemoteBackendTargetOmit<ExtArgs> | null
    /**
     * The data used to create many RemoteBackendTargets.
     */
    data: RemoteBackendTargetCreateManyInput | RemoteBackendTargetCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RemoteBackendTargetIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * RemoteBackendTarget update
   */
  export type RemoteBackendTargetUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RemoteBackendTarget
     */
    select?: RemoteBackendTargetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RemoteBackendTarget
     */
    omit?: RemoteBackendTargetOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RemoteBackendTargetInclude<ExtArgs> | null
    /**
     * The data needed to update a RemoteBackendTarget.
     */
    data: XOR<RemoteBackendTargetUpdateInput, RemoteBackendTargetUncheckedUpdateInput>
    /**
     * Choose, which RemoteBackendTarget to update.
     */
    where: RemoteBackendTargetWhereUniqueInput
  }

  /**
   * RemoteBackendTarget updateMany
   */
  export type RemoteBackendTargetUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update RemoteBackendTargets.
     */
    data: XOR<RemoteBackendTargetUpdateManyMutationInput, RemoteBackendTargetUncheckedUpdateManyInput>
    /**
     * Filter which RemoteBackendTargets to update
     */
    where?: RemoteBackendTargetWhereInput
    /**
     * Limit how many RemoteBackendTargets to update.
     */
    limit?: number
  }

  /**
   * RemoteBackendTarget updateManyAndReturn
   */
  export type RemoteBackendTargetUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RemoteBackendTarget
     */
    select?: RemoteBackendTargetSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the RemoteBackendTarget
     */
    omit?: RemoteBackendTargetOmit<ExtArgs> | null
    /**
     * The data used to update RemoteBackendTargets.
     */
    data: XOR<RemoteBackendTargetUpdateManyMutationInput, RemoteBackendTargetUncheckedUpdateManyInput>
    /**
     * Filter which RemoteBackendTargets to update
     */
    where?: RemoteBackendTargetWhereInput
    /**
     * Limit how many RemoteBackendTargets to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RemoteBackendTargetIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * RemoteBackendTarget upsert
   */
  export type RemoteBackendTargetUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RemoteBackendTarget
     */
    select?: RemoteBackendTargetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RemoteBackendTarget
     */
    omit?: RemoteBackendTargetOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RemoteBackendTargetInclude<ExtArgs> | null
    /**
     * The filter to search for the RemoteBackendTarget to update in case it exists.
     */
    where: RemoteBackendTargetWhereUniqueInput
    /**
     * In case the RemoteBackendTarget found by the `where` argument doesn't exist, create a new RemoteBackendTarget with this data.
     */
    create: XOR<RemoteBackendTargetCreateInput, RemoteBackendTargetUncheckedCreateInput>
    /**
     * In case the RemoteBackendTarget was found with the provided `where` argument, update it with this data.
     */
    update: XOR<RemoteBackendTargetUpdateInput, RemoteBackendTargetUncheckedUpdateInput>
  }

  /**
   * RemoteBackendTarget delete
   */
  export type RemoteBackendTargetDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RemoteBackendTarget
     */
    select?: RemoteBackendTargetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RemoteBackendTarget
     */
    omit?: RemoteBackendTargetOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RemoteBackendTargetInclude<ExtArgs> | null
    /**
     * Filter which RemoteBackendTarget to delete.
     */
    where: RemoteBackendTargetWhereUniqueInput
  }

  /**
   * RemoteBackendTarget deleteMany
   */
  export type RemoteBackendTargetDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which RemoteBackendTargets to delete
     */
    where?: RemoteBackendTargetWhereInput
    /**
     * Limit how many RemoteBackendTargets to delete.
     */
    limit?: number
  }

  /**
   * RemoteBackendTarget.activeForUsers
   */
  export type RemoteBackendTarget$activeForUsersArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserBackendPreference
     */
    select?: UserBackendPreferenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserBackendPreference
     */
    omit?: UserBackendPreferenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserBackendPreferenceInclude<ExtArgs> | null
    where?: UserBackendPreferenceWhereInput
    orderBy?: UserBackendPreferenceOrderByWithRelationInput | UserBackendPreferenceOrderByWithRelationInput[]
    cursor?: UserBackendPreferenceWhereUniqueInput
    take?: number
    skip?: number
    distinct?: UserBackendPreferenceScalarFieldEnum | UserBackendPreferenceScalarFieldEnum[]
  }

  /**
   * RemoteBackendTarget without action
   */
  export type RemoteBackendTargetDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RemoteBackendTarget
     */
    select?: RemoteBackendTargetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RemoteBackendTarget
     */
    omit?: RemoteBackendTargetOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RemoteBackendTargetInclude<ExtArgs> | null
  }


  /**
   * Model UserBackendPreference
   */

  export type AggregateUserBackendPreference = {
    _count: UserBackendPreferenceCountAggregateOutputType | null
    _min: UserBackendPreferenceMinAggregateOutputType | null
    _max: UserBackendPreferenceMaxAggregateOutputType | null
  }

  export type UserBackendPreferenceMinAggregateOutputType = {
    id: string | null
    userId: string | null
    orgId: string | null
    mode: string | null
    fallbackMode: string | null
    executionMode: string | null
    executionModeUpdatedAt: Date | null
    activeRemoteBackendTargetId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserBackendPreferenceMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    orgId: string | null
    mode: string | null
    fallbackMode: string | null
    executionMode: string | null
    executionModeUpdatedAt: Date | null
    activeRemoteBackendTargetId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserBackendPreferenceCountAggregateOutputType = {
    id: number
    userId: number
    orgId: number
    mode: number
    fallbackMode: number
    executionMode: number
    executionModeUpdatedAt: number
    activeRemoteBackendTargetId: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type UserBackendPreferenceMinAggregateInputType = {
    id?: true
    userId?: true
    orgId?: true
    mode?: true
    fallbackMode?: true
    executionMode?: true
    executionModeUpdatedAt?: true
    activeRemoteBackendTargetId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserBackendPreferenceMaxAggregateInputType = {
    id?: true
    userId?: true
    orgId?: true
    mode?: true
    fallbackMode?: true
    executionMode?: true
    executionModeUpdatedAt?: true
    activeRemoteBackendTargetId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserBackendPreferenceCountAggregateInputType = {
    id?: true
    userId?: true
    orgId?: true
    mode?: true
    fallbackMode?: true
    executionMode?: true
    executionModeUpdatedAt?: true
    activeRemoteBackendTargetId?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type UserBackendPreferenceAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which UserBackendPreference to aggregate.
     */
    where?: UserBackendPreferenceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserBackendPreferences to fetch.
     */
    orderBy?: UserBackendPreferenceOrderByWithRelationInput | UserBackendPreferenceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UserBackendPreferenceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserBackendPreferences from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserBackendPreferences.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned UserBackendPreferences
    **/
    _count?: true | UserBackendPreferenceCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserBackendPreferenceMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserBackendPreferenceMaxAggregateInputType
  }

  export type GetUserBackendPreferenceAggregateType<T extends UserBackendPreferenceAggregateArgs> = {
        [P in keyof T & keyof AggregateUserBackendPreference]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUserBackendPreference[P]>
      : GetScalarType<T[P], AggregateUserBackendPreference[P]>
  }




  export type UserBackendPreferenceGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserBackendPreferenceWhereInput
    orderBy?: UserBackendPreferenceOrderByWithAggregationInput | UserBackendPreferenceOrderByWithAggregationInput[]
    by: UserBackendPreferenceScalarFieldEnum[] | UserBackendPreferenceScalarFieldEnum
    having?: UserBackendPreferenceScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserBackendPreferenceCountAggregateInputType | true
    _min?: UserBackendPreferenceMinAggregateInputType
    _max?: UserBackendPreferenceMaxAggregateInputType
  }

  export type UserBackendPreferenceGroupByOutputType = {
    id: string
    userId: string
    orgId: string | null
    mode: string
    fallbackMode: string
    executionMode: string
    executionModeUpdatedAt: Date
    activeRemoteBackendTargetId: string | null
    createdAt: Date
    updatedAt: Date
    _count: UserBackendPreferenceCountAggregateOutputType | null
    _min: UserBackendPreferenceMinAggregateOutputType | null
    _max: UserBackendPreferenceMaxAggregateOutputType | null
  }

  type GetUserBackendPreferenceGroupByPayload<T extends UserBackendPreferenceGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserBackendPreferenceGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserBackendPreferenceGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserBackendPreferenceGroupByOutputType[P]>
            : GetScalarType<T[P], UserBackendPreferenceGroupByOutputType[P]>
        }
      >
    >


  export type UserBackendPreferenceSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    orgId?: boolean
    mode?: boolean
    fallbackMode?: boolean
    executionMode?: boolean
    executionModeUpdatedAt?: boolean
    activeRemoteBackendTargetId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    activeRemoteBackendTarget?: boolean | UserBackendPreference$activeRemoteBackendTargetArgs<ExtArgs>
  }, ExtArgs["result"]["userBackendPreference"]>

  export type UserBackendPreferenceSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    orgId?: boolean
    mode?: boolean
    fallbackMode?: boolean
    executionMode?: boolean
    executionModeUpdatedAt?: boolean
    activeRemoteBackendTargetId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    activeRemoteBackendTarget?: boolean | UserBackendPreference$activeRemoteBackendTargetArgs<ExtArgs>
  }, ExtArgs["result"]["userBackendPreference"]>

  export type UserBackendPreferenceSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    orgId?: boolean
    mode?: boolean
    fallbackMode?: boolean
    executionMode?: boolean
    executionModeUpdatedAt?: boolean
    activeRemoteBackendTargetId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    activeRemoteBackendTarget?: boolean | UserBackendPreference$activeRemoteBackendTargetArgs<ExtArgs>
  }, ExtArgs["result"]["userBackendPreference"]>

  export type UserBackendPreferenceSelectScalar = {
    id?: boolean
    userId?: boolean
    orgId?: boolean
    mode?: boolean
    fallbackMode?: boolean
    executionMode?: boolean
    executionModeUpdatedAt?: boolean
    activeRemoteBackendTargetId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type UserBackendPreferenceOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "userId" | "orgId" | "mode" | "fallbackMode" | "executionMode" | "executionModeUpdatedAt" | "activeRemoteBackendTargetId" | "createdAt" | "updatedAt", ExtArgs["result"]["userBackendPreference"]>
  export type UserBackendPreferenceInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    activeRemoteBackendTarget?: boolean | UserBackendPreference$activeRemoteBackendTargetArgs<ExtArgs>
  }
  export type UserBackendPreferenceIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    activeRemoteBackendTarget?: boolean | UserBackendPreference$activeRemoteBackendTargetArgs<ExtArgs>
  }
  export type UserBackendPreferenceIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    activeRemoteBackendTarget?: boolean | UserBackendPreference$activeRemoteBackendTargetArgs<ExtArgs>
  }

  export type $UserBackendPreferencePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "UserBackendPreference"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
      activeRemoteBackendTarget: Prisma.$RemoteBackendTargetPayload<ExtArgs> | null
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId: string
      orgId: string | null
      mode: string
      fallbackMode: string
      executionMode: string
      executionModeUpdatedAt: Date
      activeRemoteBackendTargetId: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["userBackendPreference"]>
    composites: {}
  }

  type UserBackendPreferenceGetPayload<S extends boolean | null | undefined | UserBackendPreferenceDefaultArgs> = $Result.GetResult<Prisma.$UserBackendPreferencePayload, S>

  type UserBackendPreferenceCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<UserBackendPreferenceFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: UserBackendPreferenceCountAggregateInputType | true
    }

  export interface UserBackendPreferenceDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['UserBackendPreference'], meta: { name: 'UserBackendPreference' } }
    /**
     * Find zero or one UserBackendPreference that matches the filter.
     * @param {UserBackendPreferenceFindUniqueArgs} args - Arguments to find a UserBackendPreference
     * @example
     * // Get one UserBackendPreference
     * const userBackendPreference = await prisma.userBackendPreference.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserBackendPreferenceFindUniqueArgs>(args: SelectSubset<T, UserBackendPreferenceFindUniqueArgs<ExtArgs>>): Prisma__UserBackendPreferenceClient<$Result.GetResult<Prisma.$UserBackendPreferencePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one UserBackendPreference that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {UserBackendPreferenceFindUniqueOrThrowArgs} args - Arguments to find a UserBackendPreference
     * @example
     * // Get one UserBackendPreference
     * const userBackendPreference = await prisma.userBackendPreference.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserBackendPreferenceFindUniqueOrThrowArgs>(args: SelectSubset<T, UserBackendPreferenceFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UserBackendPreferenceClient<$Result.GetResult<Prisma.$UserBackendPreferencePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first UserBackendPreference that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserBackendPreferenceFindFirstArgs} args - Arguments to find a UserBackendPreference
     * @example
     * // Get one UserBackendPreference
     * const userBackendPreference = await prisma.userBackendPreference.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserBackendPreferenceFindFirstArgs>(args?: SelectSubset<T, UserBackendPreferenceFindFirstArgs<ExtArgs>>): Prisma__UserBackendPreferenceClient<$Result.GetResult<Prisma.$UserBackendPreferencePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first UserBackendPreference that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserBackendPreferenceFindFirstOrThrowArgs} args - Arguments to find a UserBackendPreference
     * @example
     * // Get one UserBackendPreference
     * const userBackendPreference = await prisma.userBackendPreference.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserBackendPreferenceFindFirstOrThrowArgs>(args?: SelectSubset<T, UserBackendPreferenceFindFirstOrThrowArgs<ExtArgs>>): Prisma__UserBackendPreferenceClient<$Result.GetResult<Prisma.$UserBackendPreferencePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more UserBackendPreferences that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserBackendPreferenceFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all UserBackendPreferences
     * const userBackendPreferences = await prisma.userBackendPreference.findMany()
     * 
     * // Get first 10 UserBackendPreferences
     * const userBackendPreferences = await prisma.userBackendPreference.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const userBackendPreferenceWithIdOnly = await prisma.userBackendPreference.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends UserBackendPreferenceFindManyArgs>(args?: SelectSubset<T, UserBackendPreferenceFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserBackendPreferencePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a UserBackendPreference.
     * @param {UserBackendPreferenceCreateArgs} args - Arguments to create a UserBackendPreference.
     * @example
     * // Create one UserBackendPreference
     * const UserBackendPreference = await prisma.userBackendPreference.create({
     *   data: {
     *     // ... data to create a UserBackendPreference
     *   }
     * })
     * 
     */
    create<T extends UserBackendPreferenceCreateArgs>(args: SelectSubset<T, UserBackendPreferenceCreateArgs<ExtArgs>>): Prisma__UserBackendPreferenceClient<$Result.GetResult<Prisma.$UserBackendPreferencePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many UserBackendPreferences.
     * @param {UserBackendPreferenceCreateManyArgs} args - Arguments to create many UserBackendPreferences.
     * @example
     * // Create many UserBackendPreferences
     * const userBackendPreference = await prisma.userBackendPreference.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UserBackendPreferenceCreateManyArgs>(args?: SelectSubset<T, UserBackendPreferenceCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many UserBackendPreferences and returns the data saved in the database.
     * @param {UserBackendPreferenceCreateManyAndReturnArgs} args - Arguments to create many UserBackendPreferences.
     * @example
     * // Create many UserBackendPreferences
     * const userBackendPreference = await prisma.userBackendPreference.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many UserBackendPreferences and only return the `id`
     * const userBackendPreferenceWithIdOnly = await prisma.userBackendPreference.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends UserBackendPreferenceCreateManyAndReturnArgs>(args?: SelectSubset<T, UserBackendPreferenceCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserBackendPreferencePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a UserBackendPreference.
     * @param {UserBackendPreferenceDeleteArgs} args - Arguments to delete one UserBackendPreference.
     * @example
     * // Delete one UserBackendPreference
     * const UserBackendPreference = await prisma.userBackendPreference.delete({
     *   where: {
     *     // ... filter to delete one UserBackendPreference
     *   }
     * })
     * 
     */
    delete<T extends UserBackendPreferenceDeleteArgs>(args: SelectSubset<T, UserBackendPreferenceDeleteArgs<ExtArgs>>): Prisma__UserBackendPreferenceClient<$Result.GetResult<Prisma.$UserBackendPreferencePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one UserBackendPreference.
     * @param {UserBackendPreferenceUpdateArgs} args - Arguments to update one UserBackendPreference.
     * @example
     * // Update one UserBackendPreference
     * const userBackendPreference = await prisma.userBackendPreference.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UserBackendPreferenceUpdateArgs>(args: SelectSubset<T, UserBackendPreferenceUpdateArgs<ExtArgs>>): Prisma__UserBackendPreferenceClient<$Result.GetResult<Prisma.$UserBackendPreferencePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more UserBackendPreferences.
     * @param {UserBackendPreferenceDeleteManyArgs} args - Arguments to filter UserBackendPreferences to delete.
     * @example
     * // Delete a few UserBackendPreferences
     * const { count } = await prisma.userBackendPreference.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UserBackendPreferenceDeleteManyArgs>(args?: SelectSubset<T, UserBackendPreferenceDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more UserBackendPreferences.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserBackendPreferenceUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many UserBackendPreferences
     * const userBackendPreference = await prisma.userBackendPreference.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UserBackendPreferenceUpdateManyArgs>(args: SelectSubset<T, UserBackendPreferenceUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more UserBackendPreferences and returns the data updated in the database.
     * @param {UserBackendPreferenceUpdateManyAndReturnArgs} args - Arguments to update many UserBackendPreferences.
     * @example
     * // Update many UserBackendPreferences
     * const userBackendPreference = await prisma.userBackendPreference.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more UserBackendPreferences and only return the `id`
     * const userBackendPreferenceWithIdOnly = await prisma.userBackendPreference.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends UserBackendPreferenceUpdateManyAndReturnArgs>(args: SelectSubset<T, UserBackendPreferenceUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserBackendPreferencePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one UserBackendPreference.
     * @param {UserBackendPreferenceUpsertArgs} args - Arguments to update or create a UserBackendPreference.
     * @example
     * // Update or create a UserBackendPreference
     * const userBackendPreference = await prisma.userBackendPreference.upsert({
     *   create: {
     *     // ... data to create a UserBackendPreference
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the UserBackendPreference we want to update
     *   }
     * })
     */
    upsert<T extends UserBackendPreferenceUpsertArgs>(args: SelectSubset<T, UserBackendPreferenceUpsertArgs<ExtArgs>>): Prisma__UserBackendPreferenceClient<$Result.GetResult<Prisma.$UserBackendPreferencePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of UserBackendPreferences.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserBackendPreferenceCountArgs} args - Arguments to filter UserBackendPreferences to count.
     * @example
     * // Count the number of UserBackendPreferences
     * const count = await prisma.userBackendPreference.count({
     *   where: {
     *     // ... the filter for the UserBackendPreferences we want to count
     *   }
     * })
    **/
    count<T extends UserBackendPreferenceCountArgs>(
      args?: Subset<T, UserBackendPreferenceCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserBackendPreferenceCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a UserBackendPreference.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserBackendPreferenceAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserBackendPreferenceAggregateArgs>(args: Subset<T, UserBackendPreferenceAggregateArgs>): Prisma.PrismaPromise<GetUserBackendPreferenceAggregateType<T>>

    /**
     * Group by UserBackendPreference.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserBackendPreferenceGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserBackendPreferenceGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserBackendPreferenceGroupByArgs['orderBy'] }
        : { orderBy?: UserBackendPreferenceGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserBackendPreferenceGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserBackendPreferenceGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the UserBackendPreference model
   */
  readonly fields: UserBackendPreferenceFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for UserBackendPreference.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserBackendPreferenceClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    activeRemoteBackendTarget<T extends UserBackendPreference$activeRemoteBackendTargetArgs<ExtArgs> = {}>(args?: Subset<T, UserBackendPreference$activeRemoteBackendTargetArgs<ExtArgs>>): Prisma__RemoteBackendTargetClient<$Result.GetResult<Prisma.$RemoteBackendTargetPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the UserBackendPreference model
   */
  interface UserBackendPreferenceFieldRefs {
    readonly id: FieldRef<"UserBackendPreference", 'String'>
    readonly userId: FieldRef<"UserBackendPreference", 'String'>
    readonly orgId: FieldRef<"UserBackendPreference", 'String'>
    readonly mode: FieldRef<"UserBackendPreference", 'String'>
    readonly fallbackMode: FieldRef<"UserBackendPreference", 'String'>
    readonly executionMode: FieldRef<"UserBackendPreference", 'String'>
    readonly executionModeUpdatedAt: FieldRef<"UserBackendPreference", 'DateTime'>
    readonly activeRemoteBackendTargetId: FieldRef<"UserBackendPreference", 'String'>
    readonly createdAt: FieldRef<"UserBackendPreference", 'DateTime'>
    readonly updatedAt: FieldRef<"UserBackendPreference", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * UserBackendPreference findUnique
   */
  export type UserBackendPreferenceFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserBackendPreference
     */
    select?: UserBackendPreferenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserBackendPreference
     */
    omit?: UserBackendPreferenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserBackendPreferenceInclude<ExtArgs> | null
    /**
     * Filter, which UserBackendPreference to fetch.
     */
    where: UserBackendPreferenceWhereUniqueInput
  }

  /**
   * UserBackendPreference findUniqueOrThrow
   */
  export type UserBackendPreferenceFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserBackendPreference
     */
    select?: UserBackendPreferenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserBackendPreference
     */
    omit?: UserBackendPreferenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserBackendPreferenceInclude<ExtArgs> | null
    /**
     * Filter, which UserBackendPreference to fetch.
     */
    where: UserBackendPreferenceWhereUniqueInput
  }

  /**
   * UserBackendPreference findFirst
   */
  export type UserBackendPreferenceFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserBackendPreference
     */
    select?: UserBackendPreferenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserBackendPreference
     */
    omit?: UserBackendPreferenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserBackendPreferenceInclude<ExtArgs> | null
    /**
     * Filter, which UserBackendPreference to fetch.
     */
    where?: UserBackendPreferenceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserBackendPreferences to fetch.
     */
    orderBy?: UserBackendPreferenceOrderByWithRelationInput | UserBackendPreferenceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for UserBackendPreferences.
     */
    cursor?: UserBackendPreferenceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserBackendPreferences from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserBackendPreferences.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of UserBackendPreferences.
     */
    distinct?: UserBackendPreferenceScalarFieldEnum | UserBackendPreferenceScalarFieldEnum[]
  }

  /**
   * UserBackendPreference findFirstOrThrow
   */
  export type UserBackendPreferenceFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserBackendPreference
     */
    select?: UserBackendPreferenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserBackendPreference
     */
    omit?: UserBackendPreferenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserBackendPreferenceInclude<ExtArgs> | null
    /**
     * Filter, which UserBackendPreference to fetch.
     */
    where?: UserBackendPreferenceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserBackendPreferences to fetch.
     */
    orderBy?: UserBackendPreferenceOrderByWithRelationInput | UserBackendPreferenceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for UserBackendPreferences.
     */
    cursor?: UserBackendPreferenceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserBackendPreferences from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserBackendPreferences.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of UserBackendPreferences.
     */
    distinct?: UserBackendPreferenceScalarFieldEnum | UserBackendPreferenceScalarFieldEnum[]
  }

  /**
   * UserBackendPreference findMany
   */
  export type UserBackendPreferenceFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserBackendPreference
     */
    select?: UserBackendPreferenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserBackendPreference
     */
    omit?: UserBackendPreferenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserBackendPreferenceInclude<ExtArgs> | null
    /**
     * Filter, which UserBackendPreferences to fetch.
     */
    where?: UserBackendPreferenceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserBackendPreferences to fetch.
     */
    orderBy?: UserBackendPreferenceOrderByWithRelationInput | UserBackendPreferenceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing UserBackendPreferences.
     */
    cursor?: UserBackendPreferenceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserBackendPreferences from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserBackendPreferences.
     */
    skip?: number
    distinct?: UserBackendPreferenceScalarFieldEnum | UserBackendPreferenceScalarFieldEnum[]
  }

  /**
   * UserBackendPreference create
   */
  export type UserBackendPreferenceCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserBackendPreference
     */
    select?: UserBackendPreferenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserBackendPreference
     */
    omit?: UserBackendPreferenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserBackendPreferenceInclude<ExtArgs> | null
    /**
     * The data needed to create a UserBackendPreference.
     */
    data: XOR<UserBackendPreferenceCreateInput, UserBackendPreferenceUncheckedCreateInput>
  }

  /**
   * UserBackendPreference createMany
   */
  export type UserBackendPreferenceCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many UserBackendPreferences.
     */
    data: UserBackendPreferenceCreateManyInput | UserBackendPreferenceCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * UserBackendPreference createManyAndReturn
   */
  export type UserBackendPreferenceCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserBackendPreference
     */
    select?: UserBackendPreferenceSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the UserBackendPreference
     */
    omit?: UserBackendPreferenceOmit<ExtArgs> | null
    /**
     * The data used to create many UserBackendPreferences.
     */
    data: UserBackendPreferenceCreateManyInput | UserBackendPreferenceCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserBackendPreferenceIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * UserBackendPreference update
   */
  export type UserBackendPreferenceUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserBackendPreference
     */
    select?: UserBackendPreferenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserBackendPreference
     */
    omit?: UserBackendPreferenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserBackendPreferenceInclude<ExtArgs> | null
    /**
     * The data needed to update a UserBackendPreference.
     */
    data: XOR<UserBackendPreferenceUpdateInput, UserBackendPreferenceUncheckedUpdateInput>
    /**
     * Choose, which UserBackendPreference to update.
     */
    where: UserBackendPreferenceWhereUniqueInput
  }

  /**
   * UserBackendPreference updateMany
   */
  export type UserBackendPreferenceUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update UserBackendPreferences.
     */
    data: XOR<UserBackendPreferenceUpdateManyMutationInput, UserBackendPreferenceUncheckedUpdateManyInput>
    /**
     * Filter which UserBackendPreferences to update
     */
    where?: UserBackendPreferenceWhereInput
    /**
     * Limit how many UserBackendPreferences to update.
     */
    limit?: number
  }

  /**
   * UserBackendPreference updateManyAndReturn
   */
  export type UserBackendPreferenceUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserBackendPreference
     */
    select?: UserBackendPreferenceSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the UserBackendPreference
     */
    omit?: UserBackendPreferenceOmit<ExtArgs> | null
    /**
     * The data used to update UserBackendPreferences.
     */
    data: XOR<UserBackendPreferenceUpdateManyMutationInput, UserBackendPreferenceUncheckedUpdateManyInput>
    /**
     * Filter which UserBackendPreferences to update
     */
    where?: UserBackendPreferenceWhereInput
    /**
     * Limit how many UserBackendPreferences to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserBackendPreferenceIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * UserBackendPreference upsert
   */
  export type UserBackendPreferenceUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserBackendPreference
     */
    select?: UserBackendPreferenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserBackendPreference
     */
    omit?: UserBackendPreferenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserBackendPreferenceInclude<ExtArgs> | null
    /**
     * The filter to search for the UserBackendPreference to update in case it exists.
     */
    where: UserBackendPreferenceWhereUniqueInput
    /**
     * In case the UserBackendPreference found by the `where` argument doesn't exist, create a new UserBackendPreference with this data.
     */
    create: XOR<UserBackendPreferenceCreateInput, UserBackendPreferenceUncheckedCreateInput>
    /**
     * In case the UserBackendPreference was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserBackendPreferenceUpdateInput, UserBackendPreferenceUncheckedUpdateInput>
  }

  /**
   * UserBackendPreference delete
   */
  export type UserBackendPreferenceDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserBackendPreference
     */
    select?: UserBackendPreferenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserBackendPreference
     */
    omit?: UserBackendPreferenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserBackendPreferenceInclude<ExtArgs> | null
    /**
     * Filter which UserBackendPreference to delete.
     */
    where: UserBackendPreferenceWhereUniqueInput
  }

  /**
   * UserBackendPreference deleteMany
   */
  export type UserBackendPreferenceDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which UserBackendPreferences to delete
     */
    where?: UserBackendPreferenceWhereInput
    /**
     * Limit how many UserBackendPreferences to delete.
     */
    limit?: number
  }

  /**
   * UserBackendPreference.activeRemoteBackendTarget
   */
  export type UserBackendPreference$activeRemoteBackendTargetArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RemoteBackendTarget
     */
    select?: RemoteBackendTargetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the RemoteBackendTarget
     */
    omit?: RemoteBackendTargetOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RemoteBackendTargetInclude<ExtArgs> | null
    where?: RemoteBackendTargetWhereInput
  }

  /**
   * UserBackendPreference without action
   */
  export type UserBackendPreferenceDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserBackendPreference
     */
    select?: UserBackendPreferenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserBackendPreference
     */
    omit?: UserBackendPreferenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserBackendPreferenceInclude<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const UserScalarFieldEnum: {
    id: 'id',
    clerkId: 'clerkId',
    email: 'email',
    name: 'name',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type UserScalarFieldEnum = (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum]


  export const SshConnectionScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    name: 'name',
    host: 'host',
    port: 'port',
    username: 'username',
    authType: 'authType',
    encryptedPrivateKey: 'encryptedPrivateKey',
    encryptedPassword: 'encryptedPassword',
    status: 'status',
    os: 'os',
    architecture: 'architecture',
    dockerInstalled: 'dockerInstalled',
    a2rInstalled: 'a2rInstalled',
    a2rVersion: 'a2rVersion',
    lastConnectedAt: 'lastConnectedAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type SshConnectionScalarFieldEnum = (typeof SshConnectionScalarFieldEnum)[keyof typeof SshConnectionScalarFieldEnum]


  export const RemoteBackendTargetScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    sshConnectionId: 'sshConnectionId',
    name: 'name',
    status: 'status',
    installState: 'installState',
    backendUrl: 'backendUrl',
    gatewayUrl: 'gatewayUrl',
    gatewayWsUrl: 'gatewayWsUrl',
    encryptedGatewayToken: 'encryptedGatewayToken',
    installedVersion: 'installedVersion',
    supportedClientRange: 'supportedClientRange',
    lastVerifiedAt: 'lastVerifiedAt',
    lastHeartbeatAt: 'lastHeartbeatAt',
    lastError: 'lastError',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type RemoteBackendTargetScalarFieldEnum = (typeof RemoteBackendTargetScalarFieldEnum)[keyof typeof RemoteBackendTargetScalarFieldEnum]


  export const UserBackendPreferenceScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    orgId: 'orgId',
    mode: 'mode',
    fallbackMode: 'fallbackMode',
    executionMode: 'executionMode',
    executionModeUpdatedAt: 'executionModeUpdatedAt',
    activeRemoteBackendTargetId: 'activeRemoteBackendTargetId',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type UserBackendPreferenceScalarFieldEnum = (typeof UserBackendPreferenceScalarFieldEnum)[keyof typeof UserBackendPreferenceScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    
  /**
   * Deep Input Types
   */


  export type UserWhereInput = {
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    id?: StringFilter<"User"> | string
    clerkId?: StringFilter<"User"> | string
    email?: StringFilter<"User"> | string
    name?: StringNullableFilter<"User"> | string | null
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    sshConnections?: SshConnectionListRelationFilter
    remoteBackendTargets?: RemoteBackendTargetListRelationFilter
    backendPreference?: XOR<UserBackendPreferenceNullableScalarRelationFilter, UserBackendPreferenceWhereInput> | null
  }

  export type UserOrderByWithRelationInput = {
    id?: SortOrder
    clerkId?: SortOrder
    email?: SortOrder
    name?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    sshConnections?: SshConnectionOrderByRelationAggregateInput
    remoteBackendTargets?: RemoteBackendTargetOrderByRelationAggregateInput
    backendPreference?: UserBackendPreferenceOrderByWithRelationInput
  }

  export type UserWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    clerkId?: string
    email?: string
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    name?: StringNullableFilter<"User"> | string | null
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    sshConnections?: SshConnectionListRelationFilter
    remoteBackendTargets?: RemoteBackendTargetListRelationFilter
    backendPreference?: XOR<UserBackendPreferenceNullableScalarRelationFilter, UserBackendPreferenceWhereInput> | null
  }, "id" | "clerkId" | "email">

  export type UserOrderByWithAggregationInput = {
    id?: SortOrder
    clerkId?: SortOrder
    email?: SortOrder
    name?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: UserCountOrderByAggregateInput
    _max?: UserMaxOrderByAggregateInput
    _min?: UserMinOrderByAggregateInput
  }

  export type UserScalarWhereWithAggregatesInput = {
    AND?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    OR?: UserScalarWhereWithAggregatesInput[]
    NOT?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"User"> | string
    clerkId?: StringWithAggregatesFilter<"User"> | string
    email?: StringWithAggregatesFilter<"User"> | string
    name?: StringNullableWithAggregatesFilter<"User"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
  }

  export type SshConnectionWhereInput = {
    AND?: SshConnectionWhereInput | SshConnectionWhereInput[]
    OR?: SshConnectionWhereInput[]
    NOT?: SshConnectionWhereInput | SshConnectionWhereInput[]
    id?: StringFilter<"SshConnection"> | string
    userId?: StringFilter<"SshConnection"> | string
    name?: StringFilter<"SshConnection"> | string
    host?: StringFilter<"SshConnection"> | string
    port?: IntFilter<"SshConnection"> | number
    username?: StringFilter<"SshConnection"> | string
    authType?: StringFilter<"SshConnection"> | string
    encryptedPrivateKey?: StringNullableFilter<"SshConnection"> | string | null
    encryptedPassword?: StringNullableFilter<"SshConnection"> | string | null
    status?: StringFilter<"SshConnection"> | string
    os?: StringNullableFilter<"SshConnection"> | string | null
    architecture?: StringNullableFilter<"SshConnection"> | string | null
    dockerInstalled?: BoolNullableFilter<"SshConnection"> | boolean | null
    a2rInstalled?: BoolNullableFilter<"SshConnection"> | boolean | null
    a2rVersion?: StringNullableFilter<"SshConnection"> | string | null
    lastConnectedAt?: DateTimeNullableFilter<"SshConnection"> | Date | string | null
    createdAt?: DateTimeFilter<"SshConnection"> | Date | string
    updatedAt?: DateTimeFilter<"SshConnection"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    backendTarget?: XOR<RemoteBackendTargetNullableScalarRelationFilter, RemoteBackendTargetWhereInput> | null
  }

  export type SshConnectionOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    name?: SortOrder
    host?: SortOrder
    port?: SortOrder
    username?: SortOrder
    authType?: SortOrder
    encryptedPrivateKey?: SortOrderInput | SortOrder
    encryptedPassword?: SortOrderInput | SortOrder
    status?: SortOrder
    os?: SortOrderInput | SortOrder
    architecture?: SortOrderInput | SortOrder
    dockerInstalled?: SortOrderInput | SortOrder
    a2rInstalled?: SortOrderInput | SortOrder
    a2rVersion?: SortOrderInput | SortOrder
    lastConnectedAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    user?: UserOrderByWithRelationInput
    backendTarget?: RemoteBackendTargetOrderByWithRelationInput
  }

  export type SshConnectionWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: SshConnectionWhereInput | SshConnectionWhereInput[]
    OR?: SshConnectionWhereInput[]
    NOT?: SshConnectionWhereInput | SshConnectionWhereInput[]
    userId?: StringFilter<"SshConnection"> | string
    name?: StringFilter<"SshConnection"> | string
    host?: StringFilter<"SshConnection"> | string
    port?: IntFilter<"SshConnection"> | number
    username?: StringFilter<"SshConnection"> | string
    authType?: StringFilter<"SshConnection"> | string
    encryptedPrivateKey?: StringNullableFilter<"SshConnection"> | string | null
    encryptedPassword?: StringNullableFilter<"SshConnection"> | string | null
    status?: StringFilter<"SshConnection"> | string
    os?: StringNullableFilter<"SshConnection"> | string | null
    architecture?: StringNullableFilter<"SshConnection"> | string | null
    dockerInstalled?: BoolNullableFilter<"SshConnection"> | boolean | null
    a2rInstalled?: BoolNullableFilter<"SshConnection"> | boolean | null
    a2rVersion?: StringNullableFilter<"SshConnection"> | string | null
    lastConnectedAt?: DateTimeNullableFilter<"SshConnection"> | Date | string | null
    createdAt?: DateTimeFilter<"SshConnection"> | Date | string
    updatedAt?: DateTimeFilter<"SshConnection"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    backendTarget?: XOR<RemoteBackendTargetNullableScalarRelationFilter, RemoteBackendTargetWhereInput> | null
  }, "id">

  export type SshConnectionOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    name?: SortOrder
    host?: SortOrder
    port?: SortOrder
    username?: SortOrder
    authType?: SortOrder
    encryptedPrivateKey?: SortOrderInput | SortOrder
    encryptedPassword?: SortOrderInput | SortOrder
    status?: SortOrder
    os?: SortOrderInput | SortOrder
    architecture?: SortOrderInput | SortOrder
    dockerInstalled?: SortOrderInput | SortOrder
    a2rInstalled?: SortOrderInput | SortOrder
    a2rVersion?: SortOrderInput | SortOrder
    lastConnectedAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: SshConnectionCountOrderByAggregateInput
    _avg?: SshConnectionAvgOrderByAggregateInput
    _max?: SshConnectionMaxOrderByAggregateInput
    _min?: SshConnectionMinOrderByAggregateInput
    _sum?: SshConnectionSumOrderByAggregateInput
  }

  export type SshConnectionScalarWhereWithAggregatesInput = {
    AND?: SshConnectionScalarWhereWithAggregatesInput | SshConnectionScalarWhereWithAggregatesInput[]
    OR?: SshConnectionScalarWhereWithAggregatesInput[]
    NOT?: SshConnectionScalarWhereWithAggregatesInput | SshConnectionScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"SshConnection"> | string
    userId?: StringWithAggregatesFilter<"SshConnection"> | string
    name?: StringWithAggregatesFilter<"SshConnection"> | string
    host?: StringWithAggregatesFilter<"SshConnection"> | string
    port?: IntWithAggregatesFilter<"SshConnection"> | number
    username?: StringWithAggregatesFilter<"SshConnection"> | string
    authType?: StringWithAggregatesFilter<"SshConnection"> | string
    encryptedPrivateKey?: StringNullableWithAggregatesFilter<"SshConnection"> | string | null
    encryptedPassword?: StringNullableWithAggregatesFilter<"SshConnection"> | string | null
    status?: StringWithAggregatesFilter<"SshConnection"> | string
    os?: StringNullableWithAggregatesFilter<"SshConnection"> | string | null
    architecture?: StringNullableWithAggregatesFilter<"SshConnection"> | string | null
    dockerInstalled?: BoolNullableWithAggregatesFilter<"SshConnection"> | boolean | null
    a2rInstalled?: BoolNullableWithAggregatesFilter<"SshConnection"> | boolean | null
    a2rVersion?: StringNullableWithAggregatesFilter<"SshConnection"> | string | null
    lastConnectedAt?: DateTimeNullableWithAggregatesFilter<"SshConnection"> | Date | string | null
    createdAt?: DateTimeWithAggregatesFilter<"SshConnection"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"SshConnection"> | Date | string
  }

  export type RemoteBackendTargetWhereInput = {
    AND?: RemoteBackendTargetWhereInput | RemoteBackendTargetWhereInput[]
    OR?: RemoteBackendTargetWhereInput[]
    NOT?: RemoteBackendTargetWhereInput | RemoteBackendTargetWhereInput[]
    id?: StringFilter<"RemoteBackendTarget"> | string
    userId?: StringFilter<"RemoteBackendTarget"> | string
    sshConnectionId?: StringFilter<"RemoteBackendTarget"> | string
    name?: StringFilter<"RemoteBackendTarget"> | string
    status?: StringFilter<"RemoteBackendTarget"> | string
    installState?: StringFilter<"RemoteBackendTarget"> | string
    backendUrl?: StringNullableFilter<"RemoteBackendTarget"> | string | null
    gatewayUrl?: StringNullableFilter<"RemoteBackendTarget"> | string | null
    gatewayWsUrl?: StringNullableFilter<"RemoteBackendTarget"> | string | null
    encryptedGatewayToken?: StringNullableFilter<"RemoteBackendTarget"> | string | null
    installedVersion?: StringNullableFilter<"RemoteBackendTarget"> | string | null
    supportedClientRange?: StringNullableFilter<"RemoteBackendTarget"> | string | null
    lastVerifiedAt?: DateTimeNullableFilter<"RemoteBackendTarget"> | Date | string | null
    lastHeartbeatAt?: DateTimeNullableFilter<"RemoteBackendTarget"> | Date | string | null
    lastError?: StringNullableFilter<"RemoteBackendTarget"> | string | null
    createdAt?: DateTimeFilter<"RemoteBackendTarget"> | Date | string
    updatedAt?: DateTimeFilter<"RemoteBackendTarget"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    sshConnection?: XOR<SshConnectionScalarRelationFilter, SshConnectionWhereInput>
    activeForUsers?: UserBackendPreferenceListRelationFilter
  }

  export type RemoteBackendTargetOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    sshConnectionId?: SortOrder
    name?: SortOrder
    status?: SortOrder
    installState?: SortOrder
    backendUrl?: SortOrderInput | SortOrder
    gatewayUrl?: SortOrderInput | SortOrder
    gatewayWsUrl?: SortOrderInput | SortOrder
    encryptedGatewayToken?: SortOrderInput | SortOrder
    installedVersion?: SortOrderInput | SortOrder
    supportedClientRange?: SortOrderInput | SortOrder
    lastVerifiedAt?: SortOrderInput | SortOrder
    lastHeartbeatAt?: SortOrderInput | SortOrder
    lastError?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    user?: UserOrderByWithRelationInput
    sshConnection?: SshConnectionOrderByWithRelationInput
    activeForUsers?: UserBackendPreferenceOrderByRelationAggregateInput
  }

  export type RemoteBackendTargetWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    sshConnectionId?: string
    AND?: RemoteBackendTargetWhereInput | RemoteBackendTargetWhereInput[]
    OR?: RemoteBackendTargetWhereInput[]
    NOT?: RemoteBackendTargetWhereInput | RemoteBackendTargetWhereInput[]
    userId?: StringFilter<"RemoteBackendTarget"> | string
    name?: StringFilter<"RemoteBackendTarget"> | string
    status?: StringFilter<"RemoteBackendTarget"> | string
    installState?: StringFilter<"RemoteBackendTarget"> | string
    backendUrl?: StringNullableFilter<"RemoteBackendTarget"> | string | null
    gatewayUrl?: StringNullableFilter<"RemoteBackendTarget"> | string | null
    gatewayWsUrl?: StringNullableFilter<"RemoteBackendTarget"> | string | null
    encryptedGatewayToken?: StringNullableFilter<"RemoteBackendTarget"> | string | null
    installedVersion?: StringNullableFilter<"RemoteBackendTarget"> | string | null
    supportedClientRange?: StringNullableFilter<"RemoteBackendTarget"> | string | null
    lastVerifiedAt?: DateTimeNullableFilter<"RemoteBackendTarget"> | Date | string | null
    lastHeartbeatAt?: DateTimeNullableFilter<"RemoteBackendTarget"> | Date | string | null
    lastError?: StringNullableFilter<"RemoteBackendTarget"> | string | null
    createdAt?: DateTimeFilter<"RemoteBackendTarget"> | Date | string
    updatedAt?: DateTimeFilter<"RemoteBackendTarget"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    sshConnection?: XOR<SshConnectionScalarRelationFilter, SshConnectionWhereInput>
    activeForUsers?: UserBackendPreferenceListRelationFilter
  }, "id" | "sshConnectionId">

  export type RemoteBackendTargetOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    sshConnectionId?: SortOrder
    name?: SortOrder
    status?: SortOrder
    installState?: SortOrder
    backendUrl?: SortOrderInput | SortOrder
    gatewayUrl?: SortOrderInput | SortOrder
    gatewayWsUrl?: SortOrderInput | SortOrder
    encryptedGatewayToken?: SortOrderInput | SortOrder
    installedVersion?: SortOrderInput | SortOrder
    supportedClientRange?: SortOrderInput | SortOrder
    lastVerifiedAt?: SortOrderInput | SortOrder
    lastHeartbeatAt?: SortOrderInput | SortOrder
    lastError?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: RemoteBackendTargetCountOrderByAggregateInput
    _max?: RemoteBackendTargetMaxOrderByAggregateInput
    _min?: RemoteBackendTargetMinOrderByAggregateInput
  }

  export type RemoteBackendTargetScalarWhereWithAggregatesInput = {
    AND?: RemoteBackendTargetScalarWhereWithAggregatesInput | RemoteBackendTargetScalarWhereWithAggregatesInput[]
    OR?: RemoteBackendTargetScalarWhereWithAggregatesInput[]
    NOT?: RemoteBackendTargetScalarWhereWithAggregatesInput | RemoteBackendTargetScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"RemoteBackendTarget"> | string
    userId?: StringWithAggregatesFilter<"RemoteBackendTarget"> | string
    sshConnectionId?: StringWithAggregatesFilter<"RemoteBackendTarget"> | string
    name?: StringWithAggregatesFilter<"RemoteBackendTarget"> | string
    status?: StringWithAggregatesFilter<"RemoteBackendTarget"> | string
    installState?: StringWithAggregatesFilter<"RemoteBackendTarget"> | string
    backendUrl?: StringNullableWithAggregatesFilter<"RemoteBackendTarget"> | string | null
    gatewayUrl?: StringNullableWithAggregatesFilter<"RemoteBackendTarget"> | string | null
    gatewayWsUrl?: StringNullableWithAggregatesFilter<"RemoteBackendTarget"> | string | null
    encryptedGatewayToken?: StringNullableWithAggregatesFilter<"RemoteBackendTarget"> | string | null
    installedVersion?: StringNullableWithAggregatesFilter<"RemoteBackendTarget"> | string | null
    supportedClientRange?: StringNullableWithAggregatesFilter<"RemoteBackendTarget"> | string | null
    lastVerifiedAt?: DateTimeNullableWithAggregatesFilter<"RemoteBackendTarget"> | Date | string | null
    lastHeartbeatAt?: DateTimeNullableWithAggregatesFilter<"RemoteBackendTarget"> | Date | string | null
    lastError?: StringNullableWithAggregatesFilter<"RemoteBackendTarget"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"RemoteBackendTarget"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"RemoteBackendTarget"> | Date | string
  }

  export type UserBackendPreferenceWhereInput = {
    AND?: UserBackendPreferenceWhereInput | UserBackendPreferenceWhereInput[]
    OR?: UserBackendPreferenceWhereInput[]
    NOT?: UserBackendPreferenceWhereInput | UserBackendPreferenceWhereInput[]
    id?: StringFilter<"UserBackendPreference"> | string
    userId?: StringFilter<"UserBackendPreference"> | string
    orgId?: StringNullableFilter<"UserBackendPreference"> | string | null
    mode?: StringFilter<"UserBackendPreference"> | string
    fallbackMode?: StringFilter<"UserBackendPreference"> | string
    executionMode?: StringFilter<"UserBackendPreference"> | string
    executionModeUpdatedAt?: DateTimeFilter<"UserBackendPreference"> | Date | string
    activeRemoteBackendTargetId?: StringNullableFilter<"UserBackendPreference"> | string | null
    createdAt?: DateTimeFilter<"UserBackendPreference"> | Date | string
    updatedAt?: DateTimeFilter<"UserBackendPreference"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    activeRemoteBackendTarget?: XOR<RemoteBackendTargetNullableScalarRelationFilter, RemoteBackendTargetWhereInput> | null
  }

  export type UserBackendPreferenceOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    orgId?: SortOrderInput | SortOrder
    mode?: SortOrder
    fallbackMode?: SortOrder
    executionMode?: SortOrder
    executionModeUpdatedAt?: SortOrder
    activeRemoteBackendTargetId?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    user?: UserOrderByWithRelationInput
    activeRemoteBackendTarget?: RemoteBackendTargetOrderByWithRelationInput
  }

  export type UserBackendPreferenceWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    userId?: string
    AND?: UserBackendPreferenceWhereInput | UserBackendPreferenceWhereInput[]
    OR?: UserBackendPreferenceWhereInput[]
    NOT?: UserBackendPreferenceWhereInput | UserBackendPreferenceWhereInput[]
    orgId?: StringNullableFilter<"UserBackendPreference"> | string | null
    mode?: StringFilter<"UserBackendPreference"> | string
    fallbackMode?: StringFilter<"UserBackendPreference"> | string
    executionMode?: StringFilter<"UserBackendPreference"> | string
    executionModeUpdatedAt?: DateTimeFilter<"UserBackendPreference"> | Date | string
    activeRemoteBackendTargetId?: StringNullableFilter<"UserBackendPreference"> | string | null
    createdAt?: DateTimeFilter<"UserBackendPreference"> | Date | string
    updatedAt?: DateTimeFilter<"UserBackendPreference"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    activeRemoteBackendTarget?: XOR<RemoteBackendTargetNullableScalarRelationFilter, RemoteBackendTargetWhereInput> | null
  }, "id" | "userId">

  export type UserBackendPreferenceOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    orgId?: SortOrderInput | SortOrder
    mode?: SortOrder
    fallbackMode?: SortOrder
    executionMode?: SortOrder
    executionModeUpdatedAt?: SortOrder
    activeRemoteBackendTargetId?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: UserBackendPreferenceCountOrderByAggregateInput
    _max?: UserBackendPreferenceMaxOrderByAggregateInput
    _min?: UserBackendPreferenceMinOrderByAggregateInput
  }

  export type UserBackendPreferenceScalarWhereWithAggregatesInput = {
    AND?: UserBackendPreferenceScalarWhereWithAggregatesInput | UserBackendPreferenceScalarWhereWithAggregatesInput[]
    OR?: UserBackendPreferenceScalarWhereWithAggregatesInput[]
    NOT?: UserBackendPreferenceScalarWhereWithAggregatesInput | UserBackendPreferenceScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"UserBackendPreference"> | string
    userId?: StringWithAggregatesFilter<"UserBackendPreference"> | string
    orgId?: StringNullableWithAggregatesFilter<"UserBackendPreference"> | string | null
    mode?: StringWithAggregatesFilter<"UserBackendPreference"> | string
    fallbackMode?: StringWithAggregatesFilter<"UserBackendPreference"> | string
    executionMode?: StringWithAggregatesFilter<"UserBackendPreference"> | string
    executionModeUpdatedAt?: DateTimeWithAggregatesFilter<"UserBackendPreference"> | Date | string
    activeRemoteBackendTargetId?: StringNullableWithAggregatesFilter<"UserBackendPreference"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"UserBackendPreference"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"UserBackendPreference"> | Date | string
  }

  export type UserCreateInput = {
    id?: string
    clerkId: string
    email: string
    name?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    sshConnections?: SshConnectionCreateNestedManyWithoutUserInput
    remoteBackendTargets?: RemoteBackendTargetCreateNestedManyWithoutUserInput
    backendPreference?: UserBackendPreferenceCreateNestedOneWithoutUserInput
  }

  export type UserUncheckedCreateInput = {
    id?: string
    clerkId: string
    email: string
    name?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    sshConnections?: SshConnectionUncheckedCreateNestedManyWithoutUserInput
    remoteBackendTargets?: RemoteBackendTargetUncheckedCreateNestedManyWithoutUserInput
    backendPreference?: UserBackendPreferenceUncheckedCreateNestedOneWithoutUserInput
  }

  export type UserUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    clerkId?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sshConnections?: SshConnectionUpdateManyWithoutUserNestedInput
    remoteBackendTargets?: RemoteBackendTargetUpdateManyWithoutUserNestedInput
    backendPreference?: UserBackendPreferenceUpdateOneWithoutUserNestedInput
  }

  export type UserUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    clerkId?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sshConnections?: SshConnectionUncheckedUpdateManyWithoutUserNestedInput
    remoteBackendTargets?: RemoteBackendTargetUncheckedUpdateManyWithoutUserNestedInput
    backendPreference?: UserBackendPreferenceUncheckedUpdateOneWithoutUserNestedInput
  }

  export type UserCreateManyInput = {
    id?: string
    clerkId: string
    email: string
    name?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UserUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    clerkId?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    clerkId?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SshConnectionCreateInput = {
    id?: string
    name: string
    host: string
    port?: number
    username: string
    authType: string
    encryptedPrivateKey?: string | null
    encryptedPassword?: string | null
    status?: string
    os?: string | null
    architecture?: string | null
    dockerInstalled?: boolean | null
    a2rInstalled?: boolean | null
    a2rVersion?: string | null
    lastConnectedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutSshConnectionsInput
    backendTarget?: RemoteBackendTargetCreateNestedOneWithoutSshConnectionInput
  }

  export type SshConnectionUncheckedCreateInput = {
    id?: string
    userId: string
    name: string
    host: string
    port?: number
    username: string
    authType: string
    encryptedPrivateKey?: string | null
    encryptedPassword?: string | null
    status?: string
    os?: string | null
    architecture?: string | null
    dockerInstalled?: boolean | null
    a2rInstalled?: boolean | null
    a2rVersion?: string | null
    lastConnectedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    backendTarget?: RemoteBackendTargetUncheckedCreateNestedOneWithoutSshConnectionInput
  }

  export type SshConnectionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    host?: StringFieldUpdateOperationsInput | string
    port?: IntFieldUpdateOperationsInput | number
    username?: StringFieldUpdateOperationsInput | string
    authType?: StringFieldUpdateOperationsInput | string
    encryptedPrivateKey?: NullableStringFieldUpdateOperationsInput | string | null
    encryptedPassword?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    os?: NullableStringFieldUpdateOperationsInput | string | null
    architecture?: NullableStringFieldUpdateOperationsInput | string | null
    dockerInstalled?: NullableBoolFieldUpdateOperationsInput | boolean | null
    a2rInstalled?: NullableBoolFieldUpdateOperationsInput | boolean | null
    a2rVersion?: NullableStringFieldUpdateOperationsInput | string | null
    lastConnectedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutSshConnectionsNestedInput
    backendTarget?: RemoteBackendTargetUpdateOneWithoutSshConnectionNestedInput
  }

  export type SshConnectionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    host?: StringFieldUpdateOperationsInput | string
    port?: IntFieldUpdateOperationsInput | number
    username?: StringFieldUpdateOperationsInput | string
    authType?: StringFieldUpdateOperationsInput | string
    encryptedPrivateKey?: NullableStringFieldUpdateOperationsInput | string | null
    encryptedPassword?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    os?: NullableStringFieldUpdateOperationsInput | string | null
    architecture?: NullableStringFieldUpdateOperationsInput | string | null
    dockerInstalled?: NullableBoolFieldUpdateOperationsInput | boolean | null
    a2rInstalled?: NullableBoolFieldUpdateOperationsInput | boolean | null
    a2rVersion?: NullableStringFieldUpdateOperationsInput | string | null
    lastConnectedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    backendTarget?: RemoteBackendTargetUncheckedUpdateOneWithoutSshConnectionNestedInput
  }

  export type SshConnectionCreateManyInput = {
    id?: string
    userId: string
    name: string
    host: string
    port?: number
    username: string
    authType: string
    encryptedPrivateKey?: string | null
    encryptedPassword?: string | null
    status?: string
    os?: string | null
    architecture?: string | null
    dockerInstalled?: boolean | null
    a2rInstalled?: boolean | null
    a2rVersion?: string | null
    lastConnectedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type SshConnectionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    host?: StringFieldUpdateOperationsInput | string
    port?: IntFieldUpdateOperationsInput | number
    username?: StringFieldUpdateOperationsInput | string
    authType?: StringFieldUpdateOperationsInput | string
    encryptedPrivateKey?: NullableStringFieldUpdateOperationsInput | string | null
    encryptedPassword?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    os?: NullableStringFieldUpdateOperationsInput | string | null
    architecture?: NullableStringFieldUpdateOperationsInput | string | null
    dockerInstalled?: NullableBoolFieldUpdateOperationsInput | boolean | null
    a2rInstalled?: NullableBoolFieldUpdateOperationsInput | boolean | null
    a2rVersion?: NullableStringFieldUpdateOperationsInput | string | null
    lastConnectedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SshConnectionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    host?: StringFieldUpdateOperationsInput | string
    port?: IntFieldUpdateOperationsInput | number
    username?: StringFieldUpdateOperationsInput | string
    authType?: StringFieldUpdateOperationsInput | string
    encryptedPrivateKey?: NullableStringFieldUpdateOperationsInput | string | null
    encryptedPassword?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    os?: NullableStringFieldUpdateOperationsInput | string | null
    architecture?: NullableStringFieldUpdateOperationsInput | string | null
    dockerInstalled?: NullableBoolFieldUpdateOperationsInput | boolean | null
    a2rInstalled?: NullableBoolFieldUpdateOperationsInput | boolean | null
    a2rVersion?: NullableStringFieldUpdateOperationsInput | string | null
    lastConnectedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RemoteBackendTargetCreateInput = {
    id?: string
    name: string
    status?: string
    installState?: string
    backendUrl?: string | null
    gatewayUrl?: string | null
    gatewayWsUrl?: string | null
    encryptedGatewayToken?: string | null
    installedVersion?: string | null
    supportedClientRange?: string | null
    lastVerifiedAt?: Date | string | null
    lastHeartbeatAt?: Date | string | null
    lastError?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutRemoteBackendTargetsInput
    sshConnection: SshConnectionCreateNestedOneWithoutBackendTargetInput
    activeForUsers?: UserBackendPreferenceCreateNestedManyWithoutActiveRemoteBackendTargetInput
  }

  export type RemoteBackendTargetUncheckedCreateInput = {
    id?: string
    userId: string
    sshConnectionId: string
    name: string
    status?: string
    installState?: string
    backendUrl?: string | null
    gatewayUrl?: string | null
    gatewayWsUrl?: string | null
    encryptedGatewayToken?: string | null
    installedVersion?: string | null
    supportedClientRange?: string | null
    lastVerifiedAt?: Date | string | null
    lastHeartbeatAt?: Date | string | null
    lastError?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    activeForUsers?: UserBackendPreferenceUncheckedCreateNestedManyWithoutActiveRemoteBackendTargetInput
  }

  export type RemoteBackendTargetUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    installState?: StringFieldUpdateOperationsInput | string
    backendUrl?: NullableStringFieldUpdateOperationsInput | string | null
    gatewayUrl?: NullableStringFieldUpdateOperationsInput | string | null
    gatewayWsUrl?: NullableStringFieldUpdateOperationsInput | string | null
    encryptedGatewayToken?: NullableStringFieldUpdateOperationsInput | string | null
    installedVersion?: NullableStringFieldUpdateOperationsInput | string | null
    supportedClientRange?: NullableStringFieldUpdateOperationsInput | string | null
    lastVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastHeartbeatAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastError?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutRemoteBackendTargetsNestedInput
    sshConnection?: SshConnectionUpdateOneRequiredWithoutBackendTargetNestedInput
    activeForUsers?: UserBackendPreferenceUpdateManyWithoutActiveRemoteBackendTargetNestedInput
  }

  export type RemoteBackendTargetUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    sshConnectionId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    installState?: StringFieldUpdateOperationsInput | string
    backendUrl?: NullableStringFieldUpdateOperationsInput | string | null
    gatewayUrl?: NullableStringFieldUpdateOperationsInput | string | null
    gatewayWsUrl?: NullableStringFieldUpdateOperationsInput | string | null
    encryptedGatewayToken?: NullableStringFieldUpdateOperationsInput | string | null
    installedVersion?: NullableStringFieldUpdateOperationsInput | string | null
    supportedClientRange?: NullableStringFieldUpdateOperationsInput | string | null
    lastVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastHeartbeatAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastError?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    activeForUsers?: UserBackendPreferenceUncheckedUpdateManyWithoutActiveRemoteBackendTargetNestedInput
  }

  export type RemoteBackendTargetCreateManyInput = {
    id?: string
    userId: string
    sshConnectionId: string
    name: string
    status?: string
    installState?: string
    backendUrl?: string | null
    gatewayUrl?: string | null
    gatewayWsUrl?: string | null
    encryptedGatewayToken?: string | null
    installedVersion?: string | null
    supportedClientRange?: string | null
    lastVerifiedAt?: Date | string | null
    lastHeartbeatAt?: Date | string | null
    lastError?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type RemoteBackendTargetUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    installState?: StringFieldUpdateOperationsInput | string
    backendUrl?: NullableStringFieldUpdateOperationsInput | string | null
    gatewayUrl?: NullableStringFieldUpdateOperationsInput | string | null
    gatewayWsUrl?: NullableStringFieldUpdateOperationsInput | string | null
    encryptedGatewayToken?: NullableStringFieldUpdateOperationsInput | string | null
    installedVersion?: NullableStringFieldUpdateOperationsInput | string | null
    supportedClientRange?: NullableStringFieldUpdateOperationsInput | string | null
    lastVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastHeartbeatAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastError?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RemoteBackendTargetUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    sshConnectionId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    installState?: StringFieldUpdateOperationsInput | string
    backendUrl?: NullableStringFieldUpdateOperationsInput | string | null
    gatewayUrl?: NullableStringFieldUpdateOperationsInput | string | null
    gatewayWsUrl?: NullableStringFieldUpdateOperationsInput | string | null
    encryptedGatewayToken?: NullableStringFieldUpdateOperationsInput | string | null
    installedVersion?: NullableStringFieldUpdateOperationsInput | string | null
    supportedClientRange?: NullableStringFieldUpdateOperationsInput | string | null
    lastVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastHeartbeatAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastError?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserBackendPreferenceCreateInput = {
    id?: string
    orgId?: string | null
    mode?: string
    fallbackMode?: string
    executionMode?: string
    executionModeUpdatedAt?: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutBackendPreferenceInput
    activeRemoteBackendTarget?: RemoteBackendTargetCreateNestedOneWithoutActiveForUsersInput
  }

  export type UserBackendPreferenceUncheckedCreateInput = {
    id?: string
    userId: string
    orgId?: string | null
    mode?: string
    fallbackMode?: string
    executionMode?: string
    executionModeUpdatedAt?: Date | string
    activeRemoteBackendTargetId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UserBackendPreferenceUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    orgId?: NullableStringFieldUpdateOperationsInput | string | null
    mode?: StringFieldUpdateOperationsInput | string
    fallbackMode?: StringFieldUpdateOperationsInput | string
    executionMode?: StringFieldUpdateOperationsInput | string
    executionModeUpdatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutBackendPreferenceNestedInput
    activeRemoteBackendTarget?: RemoteBackendTargetUpdateOneWithoutActiveForUsersNestedInput
  }

  export type UserBackendPreferenceUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    orgId?: NullableStringFieldUpdateOperationsInput | string | null
    mode?: StringFieldUpdateOperationsInput | string
    fallbackMode?: StringFieldUpdateOperationsInput | string
    executionMode?: StringFieldUpdateOperationsInput | string
    executionModeUpdatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    activeRemoteBackendTargetId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserBackendPreferenceCreateManyInput = {
    id?: string
    userId: string
    orgId?: string | null
    mode?: string
    fallbackMode?: string
    executionMode?: string
    executionModeUpdatedAt?: Date | string
    activeRemoteBackendTargetId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UserBackendPreferenceUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    orgId?: NullableStringFieldUpdateOperationsInput | string | null
    mode?: StringFieldUpdateOperationsInput | string
    fallbackMode?: StringFieldUpdateOperationsInput | string
    executionMode?: StringFieldUpdateOperationsInput | string
    executionModeUpdatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserBackendPreferenceUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    orgId?: NullableStringFieldUpdateOperationsInput | string | null
    mode?: StringFieldUpdateOperationsInput | string
    fallbackMode?: StringFieldUpdateOperationsInput | string
    executionMode?: StringFieldUpdateOperationsInput | string
    executionModeUpdatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    activeRemoteBackendTargetId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type SshConnectionListRelationFilter = {
    every?: SshConnectionWhereInput
    some?: SshConnectionWhereInput
    none?: SshConnectionWhereInput
  }

  export type RemoteBackendTargetListRelationFilter = {
    every?: RemoteBackendTargetWhereInput
    some?: RemoteBackendTargetWhereInput
    none?: RemoteBackendTargetWhereInput
  }

  export type UserBackendPreferenceNullableScalarRelationFilter = {
    is?: UserBackendPreferenceWhereInput | null
    isNot?: UserBackendPreferenceWhereInput | null
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type SshConnectionOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type RemoteBackendTargetOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type UserCountOrderByAggregateInput = {
    id?: SortOrder
    clerkId?: SortOrder
    email?: SortOrder
    name?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserMaxOrderByAggregateInput = {
    id?: SortOrder
    clerkId?: SortOrder
    email?: SortOrder
    name?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserMinOrderByAggregateInput = {
    id?: SortOrder
    clerkId?: SortOrder
    email?: SortOrder
    name?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type BoolNullableFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel> | null
    not?: NestedBoolNullableFilter<$PrismaModel> | boolean | null
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type UserScalarRelationFilter = {
    is?: UserWhereInput
    isNot?: UserWhereInput
  }

  export type RemoteBackendTargetNullableScalarRelationFilter = {
    is?: RemoteBackendTargetWhereInput | null
    isNot?: RemoteBackendTargetWhereInput | null
  }

  export type SshConnectionCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    name?: SortOrder
    host?: SortOrder
    port?: SortOrder
    username?: SortOrder
    authType?: SortOrder
    encryptedPrivateKey?: SortOrder
    encryptedPassword?: SortOrder
    status?: SortOrder
    os?: SortOrder
    architecture?: SortOrder
    dockerInstalled?: SortOrder
    a2rInstalled?: SortOrder
    a2rVersion?: SortOrder
    lastConnectedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type SshConnectionAvgOrderByAggregateInput = {
    port?: SortOrder
  }

  export type SshConnectionMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    name?: SortOrder
    host?: SortOrder
    port?: SortOrder
    username?: SortOrder
    authType?: SortOrder
    encryptedPrivateKey?: SortOrder
    encryptedPassword?: SortOrder
    status?: SortOrder
    os?: SortOrder
    architecture?: SortOrder
    dockerInstalled?: SortOrder
    a2rInstalled?: SortOrder
    a2rVersion?: SortOrder
    lastConnectedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type SshConnectionMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    name?: SortOrder
    host?: SortOrder
    port?: SortOrder
    username?: SortOrder
    authType?: SortOrder
    encryptedPrivateKey?: SortOrder
    encryptedPassword?: SortOrder
    status?: SortOrder
    os?: SortOrder
    architecture?: SortOrder
    dockerInstalled?: SortOrder
    a2rInstalled?: SortOrder
    a2rVersion?: SortOrder
    lastConnectedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type SshConnectionSumOrderByAggregateInput = {
    port?: SortOrder
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type BoolNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel> | null
    not?: NestedBoolNullableWithAggregatesFilter<$PrismaModel> | boolean | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedBoolNullableFilter<$PrismaModel>
    _max?: NestedBoolNullableFilter<$PrismaModel>
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type SshConnectionScalarRelationFilter = {
    is?: SshConnectionWhereInput
    isNot?: SshConnectionWhereInput
  }

  export type UserBackendPreferenceListRelationFilter = {
    every?: UserBackendPreferenceWhereInput
    some?: UserBackendPreferenceWhereInput
    none?: UserBackendPreferenceWhereInput
  }

  export type UserBackendPreferenceOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type RemoteBackendTargetCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    sshConnectionId?: SortOrder
    name?: SortOrder
    status?: SortOrder
    installState?: SortOrder
    backendUrl?: SortOrder
    gatewayUrl?: SortOrder
    gatewayWsUrl?: SortOrder
    encryptedGatewayToken?: SortOrder
    installedVersion?: SortOrder
    supportedClientRange?: SortOrder
    lastVerifiedAt?: SortOrder
    lastHeartbeatAt?: SortOrder
    lastError?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type RemoteBackendTargetMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    sshConnectionId?: SortOrder
    name?: SortOrder
    status?: SortOrder
    installState?: SortOrder
    backendUrl?: SortOrder
    gatewayUrl?: SortOrder
    gatewayWsUrl?: SortOrder
    encryptedGatewayToken?: SortOrder
    installedVersion?: SortOrder
    supportedClientRange?: SortOrder
    lastVerifiedAt?: SortOrder
    lastHeartbeatAt?: SortOrder
    lastError?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type RemoteBackendTargetMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    sshConnectionId?: SortOrder
    name?: SortOrder
    status?: SortOrder
    installState?: SortOrder
    backendUrl?: SortOrder
    gatewayUrl?: SortOrder
    gatewayWsUrl?: SortOrder
    encryptedGatewayToken?: SortOrder
    installedVersion?: SortOrder
    supportedClientRange?: SortOrder
    lastVerifiedAt?: SortOrder
    lastHeartbeatAt?: SortOrder
    lastError?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserBackendPreferenceCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    orgId?: SortOrder
    mode?: SortOrder
    fallbackMode?: SortOrder
    executionMode?: SortOrder
    executionModeUpdatedAt?: SortOrder
    activeRemoteBackendTargetId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserBackendPreferenceMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    orgId?: SortOrder
    mode?: SortOrder
    fallbackMode?: SortOrder
    executionMode?: SortOrder
    executionModeUpdatedAt?: SortOrder
    activeRemoteBackendTargetId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserBackendPreferenceMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    orgId?: SortOrder
    mode?: SortOrder
    fallbackMode?: SortOrder
    executionMode?: SortOrder
    executionModeUpdatedAt?: SortOrder
    activeRemoteBackendTargetId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type SshConnectionCreateNestedManyWithoutUserInput = {
    create?: XOR<SshConnectionCreateWithoutUserInput, SshConnectionUncheckedCreateWithoutUserInput> | SshConnectionCreateWithoutUserInput[] | SshConnectionUncheckedCreateWithoutUserInput[]
    connectOrCreate?: SshConnectionCreateOrConnectWithoutUserInput | SshConnectionCreateOrConnectWithoutUserInput[]
    createMany?: SshConnectionCreateManyUserInputEnvelope
    connect?: SshConnectionWhereUniqueInput | SshConnectionWhereUniqueInput[]
  }

  export type RemoteBackendTargetCreateNestedManyWithoutUserInput = {
    create?: XOR<RemoteBackendTargetCreateWithoutUserInput, RemoteBackendTargetUncheckedCreateWithoutUserInput> | RemoteBackendTargetCreateWithoutUserInput[] | RemoteBackendTargetUncheckedCreateWithoutUserInput[]
    connectOrCreate?: RemoteBackendTargetCreateOrConnectWithoutUserInput | RemoteBackendTargetCreateOrConnectWithoutUserInput[]
    createMany?: RemoteBackendTargetCreateManyUserInputEnvelope
    connect?: RemoteBackendTargetWhereUniqueInput | RemoteBackendTargetWhereUniqueInput[]
  }

  export type UserBackendPreferenceCreateNestedOneWithoutUserInput = {
    create?: XOR<UserBackendPreferenceCreateWithoutUserInput, UserBackendPreferenceUncheckedCreateWithoutUserInput>
    connectOrCreate?: UserBackendPreferenceCreateOrConnectWithoutUserInput
    connect?: UserBackendPreferenceWhereUniqueInput
  }

  export type SshConnectionUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<SshConnectionCreateWithoutUserInput, SshConnectionUncheckedCreateWithoutUserInput> | SshConnectionCreateWithoutUserInput[] | SshConnectionUncheckedCreateWithoutUserInput[]
    connectOrCreate?: SshConnectionCreateOrConnectWithoutUserInput | SshConnectionCreateOrConnectWithoutUserInput[]
    createMany?: SshConnectionCreateManyUserInputEnvelope
    connect?: SshConnectionWhereUniqueInput | SshConnectionWhereUniqueInput[]
  }

  export type RemoteBackendTargetUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<RemoteBackendTargetCreateWithoutUserInput, RemoteBackendTargetUncheckedCreateWithoutUserInput> | RemoteBackendTargetCreateWithoutUserInput[] | RemoteBackendTargetUncheckedCreateWithoutUserInput[]
    connectOrCreate?: RemoteBackendTargetCreateOrConnectWithoutUserInput | RemoteBackendTargetCreateOrConnectWithoutUserInput[]
    createMany?: RemoteBackendTargetCreateManyUserInputEnvelope
    connect?: RemoteBackendTargetWhereUniqueInput | RemoteBackendTargetWhereUniqueInput[]
  }

  export type UserBackendPreferenceUncheckedCreateNestedOneWithoutUserInput = {
    create?: XOR<UserBackendPreferenceCreateWithoutUserInput, UserBackendPreferenceUncheckedCreateWithoutUserInput>
    connectOrCreate?: UserBackendPreferenceCreateOrConnectWithoutUserInput
    connect?: UserBackendPreferenceWhereUniqueInput
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type SshConnectionUpdateManyWithoutUserNestedInput = {
    create?: XOR<SshConnectionCreateWithoutUserInput, SshConnectionUncheckedCreateWithoutUserInput> | SshConnectionCreateWithoutUserInput[] | SshConnectionUncheckedCreateWithoutUserInput[]
    connectOrCreate?: SshConnectionCreateOrConnectWithoutUserInput | SshConnectionCreateOrConnectWithoutUserInput[]
    upsert?: SshConnectionUpsertWithWhereUniqueWithoutUserInput | SshConnectionUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: SshConnectionCreateManyUserInputEnvelope
    set?: SshConnectionWhereUniqueInput | SshConnectionWhereUniqueInput[]
    disconnect?: SshConnectionWhereUniqueInput | SshConnectionWhereUniqueInput[]
    delete?: SshConnectionWhereUniqueInput | SshConnectionWhereUniqueInput[]
    connect?: SshConnectionWhereUniqueInput | SshConnectionWhereUniqueInput[]
    update?: SshConnectionUpdateWithWhereUniqueWithoutUserInput | SshConnectionUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: SshConnectionUpdateManyWithWhereWithoutUserInput | SshConnectionUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: SshConnectionScalarWhereInput | SshConnectionScalarWhereInput[]
  }

  export type RemoteBackendTargetUpdateManyWithoutUserNestedInput = {
    create?: XOR<RemoteBackendTargetCreateWithoutUserInput, RemoteBackendTargetUncheckedCreateWithoutUserInput> | RemoteBackendTargetCreateWithoutUserInput[] | RemoteBackendTargetUncheckedCreateWithoutUserInput[]
    connectOrCreate?: RemoteBackendTargetCreateOrConnectWithoutUserInput | RemoteBackendTargetCreateOrConnectWithoutUserInput[]
    upsert?: RemoteBackendTargetUpsertWithWhereUniqueWithoutUserInput | RemoteBackendTargetUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: RemoteBackendTargetCreateManyUserInputEnvelope
    set?: RemoteBackendTargetWhereUniqueInput | RemoteBackendTargetWhereUniqueInput[]
    disconnect?: RemoteBackendTargetWhereUniqueInput | RemoteBackendTargetWhereUniqueInput[]
    delete?: RemoteBackendTargetWhereUniqueInput | RemoteBackendTargetWhereUniqueInput[]
    connect?: RemoteBackendTargetWhereUniqueInput | RemoteBackendTargetWhereUniqueInput[]
    update?: RemoteBackendTargetUpdateWithWhereUniqueWithoutUserInput | RemoteBackendTargetUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: RemoteBackendTargetUpdateManyWithWhereWithoutUserInput | RemoteBackendTargetUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: RemoteBackendTargetScalarWhereInput | RemoteBackendTargetScalarWhereInput[]
  }

  export type UserBackendPreferenceUpdateOneWithoutUserNestedInput = {
    create?: XOR<UserBackendPreferenceCreateWithoutUserInput, UserBackendPreferenceUncheckedCreateWithoutUserInput>
    connectOrCreate?: UserBackendPreferenceCreateOrConnectWithoutUserInput
    upsert?: UserBackendPreferenceUpsertWithoutUserInput
    disconnect?: UserBackendPreferenceWhereInput | boolean
    delete?: UserBackendPreferenceWhereInput | boolean
    connect?: UserBackendPreferenceWhereUniqueInput
    update?: XOR<XOR<UserBackendPreferenceUpdateToOneWithWhereWithoutUserInput, UserBackendPreferenceUpdateWithoutUserInput>, UserBackendPreferenceUncheckedUpdateWithoutUserInput>
  }

  export type SshConnectionUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<SshConnectionCreateWithoutUserInput, SshConnectionUncheckedCreateWithoutUserInput> | SshConnectionCreateWithoutUserInput[] | SshConnectionUncheckedCreateWithoutUserInput[]
    connectOrCreate?: SshConnectionCreateOrConnectWithoutUserInput | SshConnectionCreateOrConnectWithoutUserInput[]
    upsert?: SshConnectionUpsertWithWhereUniqueWithoutUserInput | SshConnectionUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: SshConnectionCreateManyUserInputEnvelope
    set?: SshConnectionWhereUniqueInput | SshConnectionWhereUniqueInput[]
    disconnect?: SshConnectionWhereUniqueInput | SshConnectionWhereUniqueInput[]
    delete?: SshConnectionWhereUniqueInput | SshConnectionWhereUniqueInput[]
    connect?: SshConnectionWhereUniqueInput | SshConnectionWhereUniqueInput[]
    update?: SshConnectionUpdateWithWhereUniqueWithoutUserInput | SshConnectionUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: SshConnectionUpdateManyWithWhereWithoutUserInput | SshConnectionUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: SshConnectionScalarWhereInput | SshConnectionScalarWhereInput[]
  }

  export type RemoteBackendTargetUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<RemoteBackendTargetCreateWithoutUserInput, RemoteBackendTargetUncheckedCreateWithoutUserInput> | RemoteBackendTargetCreateWithoutUserInput[] | RemoteBackendTargetUncheckedCreateWithoutUserInput[]
    connectOrCreate?: RemoteBackendTargetCreateOrConnectWithoutUserInput | RemoteBackendTargetCreateOrConnectWithoutUserInput[]
    upsert?: RemoteBackendTargetUpsertWithWhereUniqueWithoutUserInput | RemoteBackendTargetUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: RemoteBackendTargetCreateManyUserInputEnvelope
    set?: RemoteBackendTargetWhereUniqueInput | RemoteBackendTargetWhereUniqueInput[]
    disconnect?: RemoteBackendTargetWhereUniqueInput | RemoteBackendTargetWhereUniqueInput[]
    delete?: RemoteBackendTargetWhereUniqueInput | RemoteBackendTargetWhereUniqueInput[]
    connect?: RemoteBackendTargetWhereUniqueInput | RemoteBackendTargetWhereUniqueInput[]
    update?: RemoteBackendTargetUpdateWithWhereUniqueWithoutUserInput | RemoteBackendTargetUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: RemoteBackendTargetUpdateManyWithWhereWithoutUserInput | RemoteBackendTargetUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: RemoteBackendTargetScalarWhereInput | RemoteBackendTargetScalarWhereInput[]
  }

  export type UserBackendPreferenceUncheckedUpdateOneWithoutUserNestedInput = {
    create?: XOR<UserBackendPreferenceCreateWithoutUserInput, UserBackendPreferenceUncheckedCreateWithoutUserInput>
    connectOrCreate?: UserBackendPreferenceCreateOrConnectWithoutUserInput
    upsert?: UserBackendPreferenceUpsertWithoutUserInput
    disconnect?: UserBackendPreferenceWhereInput | boolean
    delete?: UserBackendPreferenceWhereInput | boolean
    connect?: UserBackendPreferenceWhereUniqueInput
    update?: XOR<XOR<UserBackendPreferenceUpdateToOneWithWhereWithoutUserInput, UserBackendPreferenceUpdateWithoutUserInput>, UserBackendPreferenceUncheckedUpdateWithoutUserInput>
  }

  export type UserCreateNestedOneWithoutSshConnectionsInput = {
    create?: XOR<UserCreateWithoutSshConnectionsInput, UserUncheckedCreateWithoutSshConnectionsInput>
    connectOrCreate?: UserCreateOrConnectWithoutSshConnectionsInput
    connect?: UserWhereUniqueInput
  }

  export type RemoteBackendTargetCreateNestedOneWithoutSshConnectionInput = {
    create?: XOR<RemoteBackendTargetCreateWithoutSshConnectionInput, RemoteBackendTargetUncheckedCreateWithoutSshConnectionInput>
    connectOrCreate?: RemoteBackendTargetCreateOrConnectWithoutSshConnectionInput
    connect?: RemoteBackendTargetWhereUniqueInput
  }

  export type RemoteBackendTargetUncheckedCreateNestedOneWithoutSshConnectionInput = {
    create?: XOR<RemoteBackendTargetCreateWithoutSshConnectionInput, RemoteBackendTargetUncheckedCreateWithoutSshConnectionInput>
    connectOrCreate?: RemoteBackendTargetCreateOrConnectWithoutSshConnectionInput
    connect?: RemoteBackendTargetWhereUniqueInput
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type NullableBoolFieldUpdateOperationsInput = {
    set?: boolean | null
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type UserUpdateOneRequiredWithoutSshConnectionsNestedInput = {
    create?: XOR<UserCreateWithoutSshConnectionsInput, UserUncheckedCreateWithoutSshConnectionsInput>
    connectOrCreate?: UserCreateOrConnectWithoutSshConnectionsInput
    upsert?: UserUpsertWithoutSshConnectionsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutSshConnectionsInput, UserUpdateWithoutSshConnectionsInput>, UserUncheckedUpdateWithoutSshConnectionsInput>
  }

  export type RemoteBackendTargetUpdateOneWithoutSshConnectionNestedInput = {
    create?: XOR<RemoteBackendTargetCreateWithoutSshConnectionInput, RemoteBackendTargetUncheckedCreateWithoutSshConnectionInput>
    connectOrCreate?: RemoteBackendTargetCreateOrConnectWithoutSshConnectionInput
    upsert?: RemoteBackendTargetUpsertWithoutSshConnectionInput
    disconnect?: RemoteBackendTargetWhereInput | boolean
    delete?: RemoteBackendTargetWhereInput | boolean
    connect?: RemoteBackendTargetWhereUniqueInput
    update?: XOR<XOR<RemoteBackendTargetUpdateToOneWithWhereWithoutSshConnectionInput, RemoteBackendTargetUpdateWithoutSshConnectionInput>, RemoteBackendTargetUncheckedUpdateWithoutSshConnectionInput>
  }

  export type RemoteBackendTargetUncheckedUpdateOneWithoutSshConnectionNestedInput = {
    create?: XOR<RemoteBackendTargetCreateWithoutSshConnectionInput, RemoteBackendTargetUncheckedCreateWithoutSshConnectionInput>
    connectOrCreate?: RemoteBackendTargetCreateOrConnectWithoutSshConnectionInput
    upsert?: RemoteBackendTargetUpsertWithoutSshConnectionInput
    disconnect?: RemoteBackendTargetWhereInput | boolean
    delete?: RemoteBackendTargetWhereInput | boolean
    connect?: RemoteBackendTargetWhereUniqueInput
    update?: XOR<XOR<RemoteBackendTargetUpdateToOneWithWhereWithoutSshConnectionInput, RemoteBackendTargetUpdateWithoutSshConnectionInput>, RemoteBackendTargetUncheckedUpdateWithoutSshConnectionInput>
  }

  export type UserCreateNestedOneWithoutRemoteBackendTargetsInput = {
    create?: XOR<UserCreateWithoutRemoteBackendTargetsInput, UserUncheckedCreateWithoutRemoteBackendTargetsInput>
    connectOrCreate?: UserCreateOrConnectWithoutRemoteBackendTargetsInput
    connect?: UserWhereUniqueInput
  }

  export type SshConnectionCreateNestedOneWithoutBackendTargetInput = {
    create?: XOR<SshConnectionCreateWithoutBackendTargetInput, SshConnectionUncheckedCreateWithoutBackendTargetInput>
    connectOrCreate?: SshConnectionCreateOrConnectWithoutBackendTargetInput
    connect?: SshConnectionWhereUniqueInput
  }

  export type UserBackendPreferenceCreateNestedManyWithoutActiveRemoteBackendTargetInput = {
    create?: XOR<UserBackendPreferenceCreateWithoutActiveRemoteBackendTargetInput, UserBackendPreferenceUncheckedCreateWithoutActiveRemoteBackendTargetInput> | UserBackendPreferenceCreateWithoutActiveRemoteBackendTargetInput[] | UserBackendPreferenceUncheckedCreateWithoutActiveRemoteBackendTargetInput[]
    connectOrCreate?: UserBackendPreferenceCreateOrConnectWithoutActiveRemoteBackendTargetInput | UserBackendPreferenceCreateOrConnectWithoutActiveRemoteBackendTargetInput[]
    createMany?: UserBackendPreferenceCreateManyActiveRemoteBackendTargetInputEnvelope
    connect?: UserBackendPreferenceWhereUniqueInput | UserBackendPreferenceWhereUniqueInput[]
  }

  export type UserBackendPreferenceUncheckedCreateNestedManyWithoutActiveRemoteBackendTargetInput = {
    create?: XOR<UserBackendPreferenceCreateWithoutActiveRemoteBackendTargetInput, UserBackendPreferenceUncheckedCreateWithoutActiveRemoteBackendTargetInput> | UserBackendPreferenceCreateWithoutActiveRemoteBackendTargetInput[] | UserBackendPreferenceUncheckedCreateWithoutActiveRemoteBackendTargetInput[]
    connectOrCreate?: UserBackendPreferenceCreateOrConnectWithoutActiveRemoteBackendTargetInput | UserBackendPreferenceCreateOrConnectWithoutActiveRemoteBackendTargetInput[]
    createMany?: UserBackendPreferenceCreateManyActiveRemoteBackendTargetInputEnvelope
    connect?: UserBackendPreferenceWhereUniqueInput | UserBackendPreferenceWhereUniqueInput[]
  }

  export type UserUpdateOneRequiredWithoutRemoteBackendTargetsNestedInput = {
    create?: XOR<UserCreateWithoutRemoteBackendTargetsInput, UserUncheckedCreateWithoutRemoteBackendTargetsInput>
    connectOrCreate?: UserCreateOrConnectWithoutRemoteBackendTargetsInput
    upsert?: UserUpsertWithoutRemoteBackendTargetsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutRemoteBackendTargetsInput, UserUpdateWithoutRemoteBackendTargetsInput>, UserUncheckedUpdateWithoutRemoteBackendTargetsInput>
  }

  export type SshConnectionUpdateOneRequiredWithoutBackendTargetNestedInput = {
    create?: XOR<SshConnectionCreateWithoutBackendTargetInput, SshConnectionUncheckedCreateWithoutBackendTargetInput>
    connectOrCreate?: SshConnectionCreateOrConnectWithoutBackendTargetInput
    upsert?: SshConnectionUpsertWithoutBackendTargetInput
    connect?: SshConnectionWhereUniqueInput
    update?: XOR<XOR<SshConnectionUpdateToOneWithWhereWithoutBackendTargetInput, SshConnectionUpdateWithoutBackendTargetInput>, SshConnectionUncheckedUpdateWithoutBackendTargetInput>
  }

  export type UserBackendPreferenceUpdateManyWithoutActiveRemoteBackendTargetNestedInput = {
    create?: XOR<UserBackendPreferenceCreateWithoutActiveRemoteBackendTargetInput, UserBackendPreferenceUncheckedCreateWithoutActiveRemoteBackendTargetInput> | UserBackendPreferenceCreateWithoutActiveRemoteBackendTargetInput[] | UserBackendPreferenceUncheckedCreateWithoutActiveRemoteBackendTargetInput[]
    connectOrCreate?: UserBackendPreferenceCreateOrConnectWithoutActiveRemoteBackendTargetInput | UserBackendPreferenceCreateOrConnectWithoutActiveRemoteBackendTargetInput[]
    upsert?: UserBackendPreferenceUpsertWithWhereUniqueWithoutActiveRemoteBackendTargetInput | UserBackendPreferenceUpsertWithWhereUniqueWithoutActiveRemoteBackendTargetInput[]
    createMany?: UserBackendPreferenceCreateManyActiveRemoteBackendTargetInputEnvelope
    set?: UserBackendPreferenceWhereUniqueInput | UserBackendPreferenceWhereUniqueInput[]
    disconnect?: UserBackendPreferenceWhereUniqueInput | UserBackendPreferenceWhereUniqueInput[]
    delete?: UserBackendPreferenceWhereUniqueInput | UserBackendPreferenceWhereUniqueInput[]
    connect?: UserBackendPreferenceWhereUniqueInput | UserBackendPreferenceWhereUniqueInput[]
    update?: UserBackendPreferenceUpdateWithWhereUniqueWithoutActiveRemoteBackendTargetInput | UserBackendPreferenceUpdateWithWhereUniqueWithoutActiveRemoteBackendTargetInput[]
    updateMany?: UserBackendPreferenceUpdateManyWithWhereWithoutActiveRemoteBackendTargetInput | UserBackendPreferenceUpdateManyWithWhereWithoutActiveRemoteBackendTargetInput[]
    deleteMany?: UserBackendPreferenceScalarWhereInput | UserBackendPreferenceScalarWhereInput[]
  }

  export type UserBackendPreferenceUncheckedUpdateManyWithoutActiveRemoteBackendTargetNestedInput = {
    create?: XOR<UserBackendPreferenceCreateWithoutActiveRemoteBackendTargetInput, UserBackendPreferenceUncheckedCreateWithoutActiveRemoteBackendTargetInput> | UserBackendPreferenceCreateWithoutActiveRemoteBackendTargetInput[] | UserBackendPreferenceUncheckedCreateWithoutActiveRemoteBackendTargetInput[]
    connectOrCreate?: UserBackendPreferenceCreateOrConnectWithoutActiveRemoteBackendTargetInput | UserBackendPreferenceCreateOrConnectWithoutActiveRemoteBackendTargetInput[]
    upsert?: UserBackendPreferenceUpsertWithWhereUniqueWithoutActiveRemoteBackendTargetInput | UserBackendPreferenceUpsertWithWhereUniqueWithoutActiveRemoteBackendTargetInput[]
    createMany?: UserBackendPreferenceCreateManyActiveRemoteBackendTargetInputEnvelope
    set?: UserBackendPreferenceWhereUniqueInput | UserBackendPreferenceWhereUniqueInput[]
    disconnect?: UserBackendPreferenceWhereUniqueInput | UserBackendPreferenceWhereUniqueInput[]
    delete?: UserBackendPreferenceWhereUniqueInput | UserBackendPreferenceWhereUniqueInput[]
    connect?: UserBackendPreferenceWhereUniqueInput | UserBackendPreferenceWhereUniqueInput[]
    update?: UserBackendPreferenceUpdateWithWhereUniqueWithoutActiveRemoteBackendTargetInput | UserBackendPreferenceUpdateWithWhereUniqueWithoutActiveRemoteBackendTargetInput[]
    updateMany?: UserBackendPreferenceUpdateManyWithWhereWithoutActiveRemoteBackendTargetInput | UserBackendPreferenceUpdateManyWithWhereWithoutActiveRemoteBackendTargetInput[]
    deleteMany?: UserBackendPreferenceScalarWhereInput | UserBackendPreferenceScalarWhereInput[]
  }

  export type UserCreateNestedOneWithoutBackendPreferenceInput = {
    create?: XOR<UserCreateWithoutBackendPreferenceInput, UserUncheckedCreateWithoutBackendPreferenceInput>
    connectOrCreate?: UserCreateOrConnectWithoutBackendPreferenceInput
    connect?: UserWhereUniqueInput
  }

  export type RemoteBackendTargetCreateNestedOneWithoutActiveForUsersInput = {
    create?: XOR<RemoteBackendTargetCreateWithoutActiveForUsersInput, RemoteBackendTargetUncheckedCreateWithoutActiveForUsersInput>
    connectOrCreate?: RemoteBackendTargetCreateOrConnectWithoutActiveForUsersInput
    connect?: RemoteBackendTargetWhereUniqueInput
  }

  export type UserUpdateOneRequiredWithoutBackendPreferenceNestedInput = {
    create?: XOR<UserCreateWithoutBackendPreferenceInput, UserUncheckedCreateWithoutBackendPreferenceInput>
    connectOrCreate?: UserCreateOrConnectWithoutBackendPreferenceInput
    upsert?: UserUpsertWithoutBackendPreferenceInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutBackendPreferenceInput, UserUpdateWithoutBackendPreferenceInput>, UserUncheckedUpdateWithoutBackendPreferenceInput>
  }

  export type RemoteBackendTargetUpdateOneWithoutActiveForUsersNestedInput = {
    create?: XOR<RemoteBackendTargetCreateWithoutActiveForUsersInput, RemoteBackendTargetUncheckedCreateWithoutActiveForUsersInput>
    connectOrCreate?: RemoteBackendTargetCreateOrConnectWithoutActiveForUsersInput
    upsert?: RemoteBackendTargetUpsertWithoutActiveForUsersInput
    disconnect?: RemoteBackendTargetWhereInput | boolean
    delete?: RemoteBackendTargetWhereInput | boolean
    connect?: RemoteBackendTargetWhereUniqueInput
    update?: XOR<XOR<RemoteBackendTargetUpdateToOneWithWhereWithoutActiveForUsersInput, RemoteBackendTargetUpdateWithoutActiveForUsersInput>, RemoteBackendTargetUncheckedUpdateWithoutActiveForUsersInput>
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedBoolNullableFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel> | null
    not?: NestedBoolNullableFilter<$PrismaModel> | boolean | null
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedBoolNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel> | null
    not?: NestedBoolNullableWithAggregatesFilter<$PrismaModel> | boolean | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedBoolNullableFilter<$PrismaModel>
    _max?: NestedBoolNullableFilter<$PrismaModel>
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type SshConnectionCreateWithoutUserInput = {
    id?: string
    name: string
    host: string
    port?: number
    username: string
    authType: string
    encryptedPrivateKey?: string | null
    encryptedPassword?: string | null
    status?: string
    os?: string | null
    architecture?: string | null
    dockerInstalled?: boolean | null
    a2rInstalled?: boolean | null
    a2rVersion?: string | null
    lastConnectedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    backendTarget?: RemoteBackendTargetCreateNestedOneWithoutSshConnectionInput
  }

  export type SshConnectionUncheckedCreateWithoutUserInput = {
    id?: string
    name: string
    host: string
    port?: number
    username: string
    authType: string
    encryptedPrivateKey?: string | null
    encryptedPassword?: string | null
    status?: string
    os?: string | null
    architecture?: string | null
    dockerInstalled?: boolean | null
    a2rInstalled?: boolean | null
    a2rVersion?: string | null
    lastConnectedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    backendTarget?: RemoteBackendTargetUncheckedCreateNestedOneWithoutSshConnectionInput
  }

  export type SshConnectionCreateOrConnectWithoutUserInput = {
    where: SshConnectionWhereUniqueInput
    create: XOR<SshConnectionCreateWithoutUserInput, SshConnectionUncheckedCreateWithoutUserInput>
  }

  export type SshConnectionCreateManyUserInputEnvelope = {
    data: SshConnectionCreateManyUserInput | SshConnectionCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type RemoteBackendTargetCreateWithoutUserInput = {
    id?: string
    name: string
    status?: string
    installState?: string
    backendUrl?: string | null
    gatewayUrl?: string | null
    gatewayWsUrl?: string | null
    encryptedGatewayToken?: string | null
    installedVersion?: string | null
    supportedClientRange?: string | null
    lastVerifiedAt?: Date | string | null
    lastHeartbeatAt?: Date | string | null
    lastError?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    sshConnection: SshConnectionCreateNestedOneWithoutBackendTargetInput
    activeForUsers?: UserBackendPreferenceCreateNestedManyWithoutActiveRemoteBackendTargetInput
  }

  export type RemoteBackendTargetUncheckedCreateWithoutUserInput = {
    id?: string
    sshConnectionId: string
    name: string
    status?: string
    installState?: string
    backendUrl?: string | null
    gatewayUrl?: string | null
    gatewayWsUrl?: string | null
    encryptedGatewayToken?: string | null
    installedVersion?: string | null
    supportedClientRange?: string | null
    lastVerifiedAt?: Date | string | null
    lastHeartbeatAt?: Date | string | null
    lastError?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    activeForUsers?: UserBackendPreferenceUncheckedCreateNestedManyWithoutActiveRemoteBackendTargetInput
  }

  export type RemoteBackendTargetCreateOrConnectWithoutUserInput = {
    where: RemoteBackendTargetWhereUniqueInput
    create: XOR<RemoteBackendTargetCreateWithoutUserInput, RemoteBackendTargetUncheckedCreateWithoutUserInput>
  }

  export type RemoteBackendTargetCreateManyUserInputEnvelope = {
    data: RemoteBackendTargetCreateManyUserInput | RemoteBackendTargetCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type UserBackendPreferenceCreateWithoutUserInput = {
    id?: string
    orgId?: string | null
    mode?: string
    fallbackMode?: string
    executionMode?: string
    executionModeUpdatedAt?: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
    activeRemoteBackendTarget?: RemoteBackendTargetCreateNestedOneWithoutActiveForUsersInput
  }

  export type UserBackendPreferenceUncheckedCreateWithoutUserInput = {
    id?: string
    orgId?: string | null
    mode?: string
    fallbackMode?: string
    executionMode?: string
    executionModeUpdatedAt?: Date | string
    activeRemoteBackendTargetId?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UserBackendPreferenceCreateOrConnectWithoutUserInput = {
    where: UserBackendPreferenceWhereUniqueInput
    create: XOR<UserBackendPreferenceCreateWithoutUserInput, UserBackendPreferenceUncheckedCreateWithoutUserInput>
  }

  export type SshConnectionUpsertWithWhereUniqueWithoutUserInput = {
    where: SshConnectionWhereUniqueInput
    update: XOR<SshConnectionUpdateWithoutUserInput, SshConnectionUncheckedUpdateWithoutUserInput>
    create: XOR<SshConnectionCreateWithoutUserInput, SshConnectionUncheckedCreateWithoutUserInput>
  }

  export type SshConnectionUpdateWithWhereUniqueWithoutUserInput = {
    where: SshConnectionWhereUniqueInput
    data: XOR<SshConnectionUpdateWithoutUserInput, SshConnectionUncheckedUpdateWithoutUserInput>
  }

  export type SshConnectionUpdateManyWithWhereWithoutUserInput = {
    where: SshConnectionScalarWhereInput
    data: XOR<SshConnectionUpdateManyMutationInput, SshConnectionUncheckedUpdateManyWithoutUserInput>
  }

  export type SshConnectionScalarWhereInput = {
    AND?: SshConnectionScalarWhereInput | SshConnectionScalarWhereInput[]
    OR?: SshConnectionScalarWhereInput[]
    NOT?: SshConnectionScalarWhereInput | SshConnectionScalarWhereInput[]
    id?: StringFilter<"SshConnection"> | string
    userId?: StringFilter<"SshConnection"> | string
    name?: StringFilter<"SshConnection"> | string
    host?: StringFilter<"SshConnection"> | string
    port?: IntFilter<"SshConnection"> | number
    username?: StringFilter<"SshConnection"> | string
    authType?: StringFilter<"SshConnection"> | string
    encryptedPrivateKey?: StringNullableFilter<"SshConnection"> | string | null
    encryptedPassword?: StringNullableFilter<"SshConnection"> | string | null
    status?: StringFilter<"SshConnection"> | string
    os?: StringNullableFilter<"SshConnection"> | string | null
    architecture?: StringNullableFilter<"SshConnection"> | string | null
    dockerInstalled?: BoolNullableFilter<"SshConnection"> | boolean | null
    a2rInstalled?: BoolNullableFilter<"SshConnection"> | boolean | null
    a2rVersion?: StringNullableFilter<"SshConnection"> | string | null
    lastConnectedAt?: DateTimeNullableFilter<"SshConnection"> | Date | string | null
    createdAt?: DateTimeFilter<"SshConnection"> | Date | string
    updatedAt?: DateTimeFilter<"SshConnection"> | Date | string
  }

  export type RemoteBackendTargetUpsertWithWhereUniqueWithoutUserInput = {
    where: RemoteBackendTargetWhereUniqueInput
    update: XOR<RemoteBackendTargetUpdateWithoutUserInput, RemoteBackendTargetUncheckedUpdateWithoutUserInput>
    create: XOR<RemoteBackendTargetCreateWithoutUserInput, RemoteBackendTargetUncheckedCreateWithoutUserInput>
  }

  export type RemoteBackendTargetUpdateWithWhereUniqueWithoutUserInput = {
    where: RemoteBackendTargetWhereUniqueInput
    data: XOR<RemoteBackendTargetUpdateWithoutUserInput, RemoteBackendTargetUncheckedUpdateWithoutUserInput>
  }

  export type RemoteBackendTargetUpdateManyWithWhereWithoutUserInput = {
    where: RemoteBackendTargetScalarWhereInput
    data: XOR<RemoteBackendTargetUpdateManyMutationInput, RemoteBackendTargetUncheckedUpdateManyWithoutUserInput>
  }

  export type RemoteBackendTargetScalarWhereInput = {
    AND?: RemoteBackendTargetScalarWhereInput | RemoteBackendTargetScalarWhereInput[]
    OR?: RemoteBackendTargetScalarWhereInput[]
    NOT?: RemoteBackendTargetScalarWhereInput | RemoteBackendTargetScalarWhereInput[]
    id?: StringFilter<"RemoteBackendTarget"> | string
    userId?: StringFilter<"RemoteBackendTarget"> | string
    sshConnectionId?: StringFilter<"RemoteBackendTarget"> | string
    name?: StringFilter<"RemoteBackendTarget"> | string
    status?: StringFilter<"RemoteBackendTarget"> | string
    installState?: StringFilter<"RemoteBackendTarget"> | string
    backendUrl?: StringNullableFilter<"RemoteBackendTarget"> | string | null
    gatewayUrl?: StringNullableFilter<"RemoteBackendTarget"> | string | null
    gatewayWsUrl?: StringNullableFilter<"RemoteBackendTarget"> | string | null
    encryptedGatewayToken?: StringNullableFilter<"RemoteBackendTarget"> | string | null
    installedVersion?: StringNullableFilter<"RemoteBackendTarget"> | string | null
    supportedClientRange?: StringNullableFilter<"RemoteBackendTarget"> | string | null
    lastVerifiedAt?: DateTimeNullableFilter<"RemoteBackendTarget"> | Date | string | null
    lastHeartbeatAt?: DateTimeNullableFilter<"RemoteBackendTarget"> | Date | string | null
    lastError?: StringNullableFilter<"RemoteBackendTarget"> | string | null
    createdAt?: DateTimeFilter<"RemoteBackendTarget"> | Date | string
    updatedAt?: DateTimeFilter<"RemoteBackendTarget"> | Date | string
  }

  export type UserBackendPreferenceUpsertWithoutUserInput = {
    update: XOR<UserBackendPreferenceUpdateWithoutUserInput, UserBackendPreferenceUncheckedUpdateWithoutUserInput>
    create: XOR<UserBackendPreferenceCreateWithoutUserInput, UserBackendPreferenceUncheckedCreateWithoutUserInput>
    where?: UserBackendPreferenceWhereInput
  }

  export type UserBackendPreferenceUpdateToOneWithWhereWithoutUserInput = {
    where?: UserBackendPreferenceWhereInput
    data: XOR<UserBackendPreferenceUpdateWithoutUserInput, UserBackendPreferenceUncheckedUpdateWithoutUserInput>
  }

  export type UserBackendPreferenceUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    orgId?: NullableStringFieldUpdateOperationsInput | string | null
    mode?: StringFieldUpdateOperationsInput | string
    fallbackMode?: StringFieldUpdateOperationsInput | string
    executionMode?: StringFieldUpdateOperationsInput | string
    executionModeUpdatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    activeRemoteBackendTarget?: RemoteBackendTargetUpdateOneWithoutActiveForUsersNestedInput
  }

  export type UserBackendPreferenceUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    orgId?: NullableStringFieldUpdateOperationsInput | string | null
    mode?: StringFieldUpdateOperationsInput | string
    fallbackMode?: StringFieldUpdateOperationsInput | string
    executionMode?: StringFieldUpdateOperationsInput | string
    executionModeUpdatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    activeRemoteBackendTargetId?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserCreateWithoutSshConnectionsInput = {
    id?: string
    clerkId: string
    email: string
    name?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    remoteBackendTargets?: RemoteBackendTargetCreateNestedManyWithoutUserInput
    backendPreference?: UserBackendPreferenceCreateNestedOneWithoutUserInput
  }

  export type UserUncheckedCreateWithoutSshConnectionsInput = {
    id?: string
    clerkId: string
    email: string
    name?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    remoteBackendTargets?: RemoteBackendTargetUncheckedCreateNestedManyWithoutUserInput
    backendPreference?: UserBackendPreferenceUncheckedCreateNestedOneWithoutUserInput
  }

  export type UserCreateOrConnectWithoutSshConnectionsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutSshConnectionsInput, UserUncheckedCreateWithoutSshConnectionsInput>
  }

  export type RemoteBackendTargetCreateWithoutSshConnectionInput = {
    id?: string
    name: string
    status?: string
    installState?: string
    backendUrl?: string | null
    gatewayUrl?: string | null
    gatewayWsUrl?: string | null
    encryptedGatewayToken?: string | null
    installedVersion?: string | null
    supportedClientRange?: string | null
    lastVerifiedAt?: Date | string | null
    lastHeartbeatAt?: Date | string | null
    lastError?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutRemoteBackendTargetsInput
    activeForUsers?: UserBackendPreferenceCreateNestedManyWithoutActiveRemoteBackendTargetInput
  }

  export type RemoteBackendTargetUncheckedCreateWithoutSshConnectionInput = {
    id?: string
    userId: string
    name: string
    status?: string
    installState?: string
    backendUrl?: string | null
    gatewayUrl?: string | null
    gatewayWsUrl?: string | null
    encryptedGatewayToken?: string | null
    installedVersion?: string | null
    supportedClientRange?: string | null
    lastVerifiedAt?: Date | string | null
    lastHeartbeatAt?: Date | string | null
    lastError?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    activeForUsers?: UserBackendPreferenceUncheckedCreateNestedManyWithoutActiveRemoteBackendTargetInput
  }

  export type RemoteBackendTargetCreateOrConnectWithoutSshConnectionInput = {
    where: RemoteBackendTargetWhereUniqueInput
    create: XOR<RemoteBackendTargetCreateWithoutSshConnectionInput, RemoteBackendTargetUncheckedCreateWithoutSshConnectionInput>
  }

  export type UserUpsertWithoutSshConnectionsInput = {
    update: XOR<UserUpdateWithoutSshConnectionsInput, UserUncheckedUpdateWithoutSshConnectionsInput>
    create: XOR<UserCreateWithoutSshConnectionsInput, UserUncheckedCreateWithoutSshConnectionsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutSshConnectionsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutSshConnectionsInput, UserUncheckedUpdateWithoutSshConnectionsInput>
  }

  export type UserUpdateWithoutSshConnectionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    clerkId?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    remoteBackendTargets?: RemoteBackendTargetUpdateManyWithoutUserNestedInput
    backendPreference?: UserBackendPreferenceUpdateOneWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutSshConnectionsInput = {
    id?: StringFieldUpdateOperationsInput | string
    clerkId?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    remoteBackendTargets?: RemoteBackendTargetUncheckedUpdateManyWithoutUserNestedInput
    backendPreference?: UserBackendPreferenceUncheckedUpdateOneWithoutUserNestedInput
  }

  export type RemoteBackendTargetUpsertWithoutSshConnectionInput = {
    update: XOR<RemoteBackendTargetUpdateWithoutSshConnectionInput, RemoteBackendTargetUncheckedUpdateWithoutSshConnectionInput>
    create: XOR<RemoteBackendTargetCreateWithoutSshConnectionInput, RemoteBackendTargetUncheckedCreateWithoutSshConnectionInput>
    where?: RemoteBackendTargetWhereInput
  }

  export type RemoteBackendTargetUpdateToOneWithWhereWithoutSshConnectionInput = {
    where?: RemoteBackendTargetWhereInput
    data: XOR<RemoteBackendTargetUpdateWithoutSshConnectionInput, RemoteBackendTargetUncheckedUpdateWithoutSshConnectionInput>
  }

  export type RemoteBackendTargetUpdateWithoutSshConnectionInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    installState?: StringFieldUpdateOperationsInput | string
    backendUrl?: NullableStringFieldUpdateOperationsInput | string | null
    gatewayUrl?: NullableStringFieldUpdateOperationsInput | string | null
    gatewayWsUrl?: NullableStringFieldUpdateOperationsInput | string | null
    encryptedGatewayToken?: NullableStringFieldUpdateOperationsInput | string | null
    installedVersion?: NullableStringFieldUpdateOperationsInput | string | null
    supportedClientRange?: NullableStringFieldUpdateOperationsInput | string | null
    lastVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastHeartbeatAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastError?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutRemoteBackendTargetsNestedInput
    activeForUsers?: UserBackendPreferenceUpdateManyWithoutActiveRemoteBackendTargetNestedInput
  }

  export type RemoteBackendTargetUncheckedUpdateWithoutSshConnectionInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    installState?: StringFieldUpdateOperationsInput | string
    backendUrl?: NullableStringFieldUpdateOperationsInput | string | null
    gatewayUrl?: NullableStringFieldUpdateOperationsInput | string | null
    gatewayWsUrl?: NullableStringFieldUpdateOperationsInput | string | null
    encryptedGatewayToken?: NullableStringFieldUpdateOperationsInput | string | null
    installedVersion?: NullableStringFieldUpdateOperationsInput | string | null
    supportedClientRange?: NullableStringFieldUpdateOperationsInput | string | null
    lastVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastHeartbeatAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastError?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    activeForUsers?: UserBackendPreferenceUncheckedUpdateManyWithoutActiveRemoteBackendTargetNestedInput
  }

  export type UserCreateWithoutRemoteBackendTargetsInput = {
    id?: string
    clerkId: string
    email: string
    name?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    sshConnections?: SshConnectionCreateNestedManyWithoutUserInput
    backendPreference?: UserBackendPreferenceCreateNestedOneWithoutUserInput
  }

  export type UserUncheckedCreateWithoutRemoteBackendTargetsInput = {
    id?: string
    clerkId: string
    email: string
    name?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    sshConnections?: SshConnectionUncheckedCreateNestedManyWithoutUserInput
    backendPreference?: UserBackendPreferenceUncheckedCreateNestedOneWithoutUserInput
  }

  export type UserCreateOrConnectWithoutRemoteBackendTargetsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutRemoteBackendTargetsInput, UserUncheckedCreateWithoutRemoteBackendTargetsInput>
  }

  export type SshConnectionCreateWithoutBackendTargetInput = {
    id?: string
    name: string
    host: string
    port?: number
    username: string
    authType: string
    encryptedPrivateKey?: string | null
    encryptedPassword?: string | null
    status?: string
    os?: string | null
    architecture?: string | null
    dockerInstalled?: boolean | null
    a2rInstalled?: boolean | null
    a2rVersion?: string | null
    lastConnectedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutSshConnectionsInput
  }

  export type SshConnectionUncheckedCreateWithoutBackendTargetInput = {
    id?: string
    userId: string
    name: string
    host: string
    port?: number
    username: string
    authType: string
    encryptedPrivateKey?: string | null
    encryptedPassword?: string | null
    status?: string
    os?: string | null
    architecture?: string | null
    dockerInstalled?: boolean | null
    a2rInstalled?: boolean | null
    a2rVersion?: string | null
    lastConnectedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type SshConnectionCreateOrConnectWithoutBackendTargetInput = {
    where: SshConnectionWhereUniqueInput
    create: XOR<SshConnectionCreateWithoutBackendTargetInput, SshConnectionUncheckedCreateWithoutBackendTargetInput>
  }

  export type UserBackendPreferenceCreateWithoutActiveRemoteBackendTargetInput = {
    id?: string
    orgId?: string | null
    mode?: string
    fallbackMode?: string
    executionMode?: string
    executionModeUpdatedAt?: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutBackendPreferenceInput
  }

  export type UserBackendPreferenceUncheckedCreateWithoutActiveRemoteBackendTargetInput = {
    id?: string
    userId: string
    orgId?: string | null
    mode?: string
    fallbackMode?: string
    executionMode?: string
    executionModeUpdatedAt?: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UserBackendPreferenceCreateOrConnectWithoutActiveRemoteBackendTargetInput = {
    where: UserBackendPreferenceWhereUniqueInput
    create: XOR<UserBackendPreferenceCreateWithoutActiveRemoteBackendTargetInput, UserBackendPreferenceUncheckedCreateWithoutActiveRemoteBackendTargetInput>
  }

  export type UserBackendPreferenceCreateManyActiveRemoteBackendTargetInputEnvelope = {
    data: UserBackendPreferenceCreateManyActiveRemoteBackendTargetInput | UserBackendPreferenceCreateManyActiveRemoteBackendTargetInput[]
    skipDuplicates?: boolean
  }

  export type UserUpsertWithoutRemoteBackendTargetsInput = {
    update: XOR<UserUpdateWithoutRemoteBackendTargetsInput, UserUncheckedUpdateWithoutRemoteBackendTargetsInput>
    create: XOR<UserCreateWithoutRemoteBackendTargetsInput, UserUncheckedCreateWithoutRemoteBackendTargetsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutRemoteBackendTargetsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutRemoteBackendTargetsInput, UserUncheckedUpdateWithoutRemoteBackendTargetsInput>
  }

  export type UserUpdateWithoutRemoteBackendTargetsInput = {
    id?: StringFieldUpdateOperationsInput | string
    clerkId?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sshConnections?: SshConnectionUpdateManyWithoutUserNestedInput
    backendPreference?: UserBackendPreferenceUpdateOneWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutRemoteBackendTargetsInput = {
    id?: StringFieldUpdateOperationsInput | string
    clerkId?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sshConnections?: SshConnectionUncheckedUpdateManyWithoutUserNestedInput
    backendPreference?: UserBackendPreferenceUncheckedUpdateOneWithoutUserNestedInput
  }

  export type SshConnectionUpsertWithoutBackendTargetInput = {
    update: XOR<SshConnectionUpdateWithoutBackendTargetInput, SshConnectionUncheckedUpdateWithoutBackendTargetInput>
    create: XOR<SshConnectionCreateWithoutBackendTargetInput, SshConnectionUncheckedCreateWithoutBackendTargetInput>
    where?: SshConnectionWhereInput
  }

  export type SshConnectionUpdateToOneWithWhereWithoutBackendTargetInput = {
    where?: SshConnectionWhereInput
    data: XOR<SshConnectionUpdateWithoutBackendTargetInput, SshConnectionUncheckedUpdateWithoutBackendTargetInput>
  }

  export type SshConnectionUpdateWithoutBackendTargetInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    host?: StringFieldUpdateOperationsInput | string
    port?: IntFieldUpdateOperationsInput | number
    username?: StringFieldUpdateOperationsInput | string
    authType?: StringFieldUpdateOperationsInput | string
    encryptedPrivateKey?: NullableStringFieldUpdateOperationsInput | string | null
    encryptedPassword?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    os?: NullableStringFieldUpdateOperationsInput | string | null
    architecture?: NullableStringFieldUpdateOperationsInput | string | null
    dockerInstalled?: NullableBoolFieldUpdateOperationsInput | boolean | null
    a2rInstalled?: NullableBoolFieldUpdateOperationsInput | boolean | null
    a2rVersion?: NullableStringFieldUpdateOperationsInput | string | null
    lastConnectedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutSshConnectionsNestedInput
  }

  export type SshConnectionUncheckedUpdateWithoutBackendTargetInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    host?: StringFieldUpdateOperationsInput | string
    port?: IntFieldUpdateOperationsInput | number
    username?: StringFieldUpdateOperationsInput | string
    authType?: StringFieldUpdateOperationsInput | string
    encryptedPrivateKey?: NullableStringFieldUpdateOperationsInput | string | null
    encryptedPassword?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    os?: NullableStringFieldUpdateOperationsInput | string | null
    architecture?: NullableStringFieldUpdateOperationsInput | string | null
    dockerInstalled?: NullableBoolFieldUpdateOperationsInput | boolean | null
    a2rInstalled?: NullableBoolFieldUpdateOperationsInput | boolean | null
    a2rVersion?: NullableStringFieldUpdateOperationsInput | string | null
    lastConnectedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserBackendPreferenceUpsertWithWhereUniqueWithoutActiveRemoteBackendTargetInput = {
    where: UserBackendPreferenceWhereUniqueInput
    update: XOR<UserBackendPreferenceUpdateWithoutActiveRemoteBackendTargetInput, UserBackendPreferenceUncheckedUpdateWithoutActiveRemoteBackendTargetInput>
    create: XOR<UserBackendPreferenceCreateWithoutActiveRemoteBackendTargetInput, UserBackendPreferenceUncheckedCreateWithoutActiveRemoteBackendTargetInput>
  }

  export type UserBackendPreferenceUpdateWithWhereUniqueWithoutActiveRemoteBackendTargetInput = {
    where: UserBackendPreferenceWhereUniqueInput
    data: XOR<UserBackendPreferenceUpdateWithoutActiveRemoteBackendTargetInput, UserBackendPreferenceUncheckedUpdateWithoutActiveRemoteBackendTargetInput>
  }

  export type UserBackendPreferenceUpdateManyWithWhereWithoutActiveRemoteBackendTargetInput = {
    where: UserBackendPreferenceScalarWhereInput
    data: XOR<UserBackendPreferenceUpdateManyMutationInput, UserBackendPreferenceUncheckedUpdateManyWithoutActiveRemoteBackendTargetInput>
  }

  export type UserBackendPreferenceScalarWhereInput = {
    AND?: UserBackendPreferenceScalarWhereInput | UserBackendPreferenceScalarWhereInput[]
    OR?: UserBackendPreferenceScalarWhereInput[]
    NOT?: UserBackendPreferenceScalarWhereInput | UserBackendPreferenceScalarWhereInput[]
    id?: StringFilter<"UserBackendPreference"> | string
    userId?: StringFilter<"UserBackendPreference"> | string
    orgId?: StringNullableFilter<"UserBackendPreference"> | string | null
    mode?: StringFilter<"UserBackendPreference"> | string
    fallbackMode?: StringFilter<"UserBackendPreference"> | string
    executionMode?: StringFilter<"UserBackendPreference"> | string
    executionModeUpdatedAt?: DateTimeFilter<"UserBackendPreference"> | Date | string
    activeRemoteBackendTargetId?: StringNullableFilter<"UserBackendPreference"> | string | null
    createdAt?: DateTimeFilter<"UserBackendPreference"> | Date | string
    updatedAt?: DateTimeFilter<"UserBackendPreference"> | Date | string
  }

  export type UserCreateWithoutBackendPreferenceInput = {
    id?: string
    clerkId: string
    email: string
    name?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    sshConnections?: SshConnectionCreateNestedManyWithoutUserInput
    remoteBackendTargets?: RemoteBackendTargetCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutBackendPreferenceInput = {
    id?: string
    clerkId: string
    email: string
    name?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    sshConnections?: SshConnectionUncheckedCreateNestedManyWithoutUserInput
    remoteBackendTargets?: RemoteBackendTargetUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutBackendPreferenceInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutBackendPreferenceInput, UserUncheckedCreateWithoutBackendPreferenceInput>
  }

  export type RemoteBackendTargetCreateWithoutActiveForUsersInput = {
    id?: string
    name: string
    status?: string
    installState?: string
    backendUrl?: string | null
    gatewayUrl?: string | null
    gatewayWsUrl?: string | null
    encryptedGatewayToken?: string | null
    installedVersion?: string | null
    supportedClientRange?: string | null
    lastVerifiedAt?: Date | string | null
    lastHeartbeatAt?: Date | string | null
    lastError?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutRemoteBackendTargetsInput
    sshConnection: SshConnectionCreateNestedOneWithoutBackendTargetInput
  }

  export type RemoteBackendTargetUncheckedCreateWithoutActiveForUsersInput = {
    id?: string
    userId: string
    sshConnectionId: string
    name: string
    status?: string
    installState?: string
    backendUrl?: string | null
    gatewayUrl?: string | null
    gatewayWsUrl?: string | null
    encryptedGatewayToken?: string | null
    installedVersion?: string | null
    supportedClientRange?: string | null
    lastVerifiedAt?: Date | string | null
    lastHeartbeatAt?: Date | string | null
    lastError?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type RemoteBackendTargetCreateOrConnectWithoutActiveForUsersInput = {
    where: RemoteBackendTargetWhereUniqueInput
    create: XOR<RemoteBackendTargetCreateWithoutActiveForUsersInput, RemoteBackendTargetUncheckedCreateWithoutActiveForUsersInput>
  }

  export type UserUpsertWithoutBackendPreferenceInput = {
    update: XOR<UserUpdateWithoutBackendPreferenceInput, UserUncheckedUpdateWithoutBackendPreferenceInput>
    create: XOR<UserCreateWithoutBackendPreferenceInput, UserUncheckedCreateWithoutBackendPreferenceInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutBackendPreferenceInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutBackendPreferenceInput, UserUncheckedUpdateWithoutBackendPreferenceInput>
  }

  export type UserUpdateWithoutBackendPreferenceInput = {
    id?: StringFieldUpdateOperationsInput | string
    clerkId?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sshConnections?: SshConnectionUpdateManyWithoutUserNestedInput
    remoteBackendTargets?: RemoteBackendTargetUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutBackendPreferenceInput = {
    id?: StringFieldUpdateOperationsInput | string
    clerkId?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    name?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sshConnections?: SshConnectionUncheckedUpdateManyWithoutUserNestedInput
    remoteBackendTargets?: RemoteBackendTargetUncheckedUpdateManyWithoutUserNestedInput
  }

  export type RemoteBackendTargetUpsertWithoutActiveForUsersInput = {
    update: XOR<RemoteBackendTargetUpdateWithoutActiveForUsersInput, RemoteBackendTargetUncheckedUpdateWithoutActiveForUsersInput>
    create: XOR<RemoteBackendTargetCreateWithoutActiveForUsersInput, RemoteBackendTargetUncheckedCreateWithoutActiveForUsersInput>
    where?: RemoteBackendTargetWhereInput
  }

  export type RemoteBackendTargetUpdateToOneWithWhereWithoutActiveForUsersInput = {
    where?: RemoteBackendTargetWhereInput
    data: XOR<RemoteBackendTargetUpdateWithoutActiveForUsersInput, RemoteBackendTargetUncheckedUpdateWithoutActiveForUsersInput>
  }

  export type RemoteBackendTargetUpdateWithoutActiveForUsersInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    installState?: StringFieldUpdateOperationsInput | string
    backendUrl?: NullableStringFieldUpdateOperationsInput | string | null
    gatewayUrl?: NullableStringFieldUpdateOperationsInput | string | null
    gatewayWsUrl?: NullableStringFieldUpdateOperationsInput | string | null
    encryptedGatewayToken?: NullableStringFieldUpdateOperationsInput | string | null
    installedVersion?: NullableStringFieldUpdateOperationsInput | string | null
    supportedClientRange?: NullableStringFieldUpdateOperationsInput | string | null
    lastVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastHeartbeatAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastError?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutRemoteBackendTargetsNestedInput
    sshConnection?: SshConnectionUpdateOneRequiredWithoutBackendTargetNestedInput
  }

  export type RemoteBackendTargetUncheckedUpdateWithoutActiveForUsersInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    sshConnectionId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    installState?: StringFieldUpdateOperationsInput | string
    backendUrl?: NullableStringFieldUpdateOperationsInput | string | null
    gatewayUrl?: NullableStringFieldUpdateOperationsInput | string | null
    gatewayWsUrl?: NullableStringFieldUpdateOperationsInput | string | null
    encryptedGatewayToken?: NullableStringFieldUpdateOperationsInput | string | null
    installedVersion?: NullableStringFieldUpdateOperationsInput | string | null
    supportedClientRange?: NullableStringFieldUpdateOperationsInput | string | null
    lastVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastHeartbeatAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastError?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SshConnectionCreateManyUserInput = {
    id?: string
    name: string
    host: string
    port?: number
    username: string
    authType: string
    encryptedPrivateKey?: string | null
    encryptedPassword?: string | null
    status?: string
    os?: string | null
    architecture?: string | null
    dockerInstalled?: boolean | null
    a2rInstalled?: boolean | null
    a2rVersion?: string | null
    lastConnectedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type RemoteBackendTargetCreateManyUserInput = {
    id?: string
    sshConnectionId: string
    name: string
    status?: string
    installState?: string
    backendUrl?: string | null
    gatewayUrl?: string | null
    gatewayWsUrl?: string | null
    encryptedGatewayToken?: string | null
    installedVersion?: string | null
    supportedClientRange?: string | null
    lastVerifiedAt?: Date | string | null
    lastHeartbeatAt?: Date | string | null
    lastError?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type SshConnectionUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    host?: StringFieldUpdateOperationsInput | string
    port?: IntFieldUpdateOperationsInput | number
    username?: StringFieldUpdateOperationsInput | string
    authType?: StringFieldUpdateOperationsInput | string
    encryptedPrivateKey?: NullableStringFieldUpdateOperationsInput | string | null
    encryptedPassword?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    os?: NullableStringFieldUpdateOperationsInput | string | null
    architecture?: NullableStringFieldUpdateOperationsInput | string | null
    dockerInstalled?: NullableBoolFieldUpdateOperationsInput | boolean | null
    a2rInstalled?: NullableBoolFieldUpdateOperationsInput | boolean | null
    a2rVersion?: NullableStringFieldUpdateOperationsInput | string | null
    lastConnectedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    backendTarget?: RemoteBackendTargetUpdateOneWithoutSshConnectionNestedInput
  }

  export type SshConnectionUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    host?: StringFieldUpdateOperationsInput | string
    port?: IntFieldUpdateOperationsInput | number
    username?: StringFieldUpdateOperationsInput | string
    authType?: StringFieldUpdateOperationsInput | string
    encryptedPrivateKey?: NullableStringFieldUpdateOperationsInput | string | null
    encryptedPassword?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    os?: NullableStringFieldUpdateOperationsInput | string | null
    architecture?: NullableStringFieldUpdateOperationsInput | string | null
    dockerInstalled?: NullableBoolFieldUpdateOperationsInput | boolean | null
    a2rInstalled?: NullableBoolFieldUpdateOperationsInput | boolean | null
    a2rVersion?: NullableStringFieldUpdateOperationsInput | string | null
    lastConnectedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    backendTarget?: RemoteBackendTargetUncheckedUpdateOneWithoutSshConnectionNestedInput
  }

  export type SshConnectionUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    host?: StringFieldUpdateOperationsInput | string
    port?: IntFieldUpdateOperationsInput | number
    username?: StringFieldUpdateOperationsInput | string
    authType?: StringFieldUpdateOperationsInput | string
    encryptedPrivateKey?: NullableStringFieldUpdateOperationsInput | string | null
    encryptedPassword?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    os?: NullableStringFieldUpdateOperationsInput | string | null
    architecture?: NullableStringFieldUpdateOperationsInput | string | null
    dockerInstalled?: NullableBoolFieldUpdateOperationsInput | boolean | null
    a2rInstalled?: NullableBoolFieldUpdateOperationsInput | boolean | null
    a2rVersion?: NullableStringFieldUpdateOperationsInput | string | null
    lastConnectedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RemoteBackendTargetUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    installState?: StringFieldUpdateOperationsInput | string
    backendUrl?: NullableStringFieldUpdateOperationsInput | string | null
    gatewayUrl?: NullableStringFieldUpdateOperationsInput | string | null
    gatewayWsUrl?: NullableStringFieldUpdateOperationsInput | string | null
    encryptedGatewayToken?: NullableStringFieldUpdateOperationsInput | string | null
    installedVersion?: NullableStringFieldUpdateOperationsInput | string | null
    supportedClientRange?: NullableStringFieldUpdateOperationsInput | string | null
    lastVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastHeartbeatAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastError?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    sshConnection?: SshConnectionUpdateOneRequiredWithoutBackendTargetNestedInput
    activeForUsers?: UserBackendPreferenceUpdateManyWithoutActiveRemoteBackendTargetNestedInput
  }

  export type RemoteBackendTargetUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    sshConnectionId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    installState?: StringFieldUpdateOperationsInput | string
    backendUrl?: NullableStringFieldUpdateOperationsInput | string | null
    gatewayUrl?: NullableStringFieldUpdateOperationsInput | string | null
    gatewayWsUrl?: NullableStringFieldUpdateOperationsInput | string | null
    encryptedGatewayToken?: NullableStringFieldUpdateOperationsInput | string | null
    installedVersion?: NullableStringFieldUpdateOperationsInput | string | null
    supportedClientRange?: NullableStringFieldUpdateOperationsInput | string | null
    lastVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastHeartbeatAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastError?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    activeForUsers?: UserBackendPreferenceUncheckedUpdateManyWithoutActiveRemoteBackendTargetNestedInput
  }

  export type RemoteBackendTargetUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    sshConnectionId?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    installState?: StringFieldUpdateOperationsInput | string
    backendUrl?: NullableStringFieldUpdateOperationsInput | string | null
    gatewayUrl?: NullableStringFieldUpdateOperationsInput | string | null
    gatewayWsUrl?: NullableStringFieldUpdateOperationsInput | string | null
    encryptedGatewayToken?: NullableStringFieldUpdateOperationsInput | string | null
    installedVersion?: NullableStringFieldUpdateOperationsInput | string | null
    supportedClientRange?: NullableStringFieldUpdateOperationsInput | string | null
    lastVerifiedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastHeartbeatAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    lastError?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserBackendPreferenceCreateManyActiveRemoteBackendTargetInput = {
    id?: string
    userId: string
    orgId?: string | null
    mode?: string
    fallbackMode?: string
    executionMode?: string
    executionModeUpdatedAt?: Date | string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UserBackendPreferenceUpdateWithoutActiveRemoteBackendTargetInput = {
    id?: StringFieldUpdateOperationsInput | string
    orgId?: NullableStringFieldUpdateOperationsInput | string | null
    mode?: StringFieldUpdateOperationsInput | string
    fallbackMode?: StringFieldUpdateOperationsInput | string
    executionMode?: StringFieldUpdateOperationsInput | string
    executionModeUpdatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutBackendPreferenceNestedInput
  }

  export type UserBackendPreferenceUncheckedUpdateWithoutActiveRemoteBackendTargetInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    orgId?: NullableStringFieldUpdateOperationsInput | string | null
    mode?: StringFieldUpdateOperationsInput | string
    fallbackMode?: StringFieldUpdateOperationsInput | string
    executionMode?: StringFieldUpdateOperationsInput | string
    executionModeUpdatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserBackendPreferenceUncheckedUpdateManyWithoutActiveRemoteBackendTargetInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    orgId?: NullableStringFieldUpdateOperationsInput | string | null
    mode?: StringFieldUpdateOperationsInput | string
    fallbackMode?: StringFieldUpdateOperationsInput | string
    executionMode?: StringFieldUpdateOperationsInput | string
    executionModeUpdatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}