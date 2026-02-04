declare module 'connect-pg-simple' {
  import { Store } from 'express-session';

  interface Options {
    pool?: any;
    tableName?: string;
    schemaName?: string;
    ttl?: number;
    disableTouch?: boolean;
    disableTTLExtension?: boolean;
    pruneSessionInterval?: number;
  }

  function connectPgSimple(session: any): any;

  export default connectPgSimple;
  export = connectPgSimple;
}
