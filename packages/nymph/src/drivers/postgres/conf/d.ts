/**
 * PostgreSQL Driver Config
 */
export interface PostgreSQLDriverConfig {
  /**
   * Connection Type
   * The type of connection to establish with PostreSQL. Choosing socket will
   * attempt to use the default socket path. You can also choose host and
   * provide the socket path as the host. If you get errors that it can't
   * connect, check that your pg_hba.conf file allows the specified user to
   * access the database through a socket.
   *
   * Options are: "host", "socket"
   */
  connectionType: string;
  /**
   * Host
   * The host on which to connect to PostgreSQL.
   */
  host: string;
  /**
   * Port
   * The port on which to connect to PostgreSQL.
   */
  port: number;
  /**
   * User
   * The PostgreSQL user.
   */
  user: string;
  /**
   * Password
   * The PostgreSQL password.
   */
  password: string;
  /**
   * Database
   * The PostgreSQL database.
   */
  database: string;
  /**
   * Table Prefix
   * The PostgreSQL table name prefix.
   */
  prefix: string;
  /**
   * Use PL/Perl Functions
   * This speeds up PCRE regular expression matching ("match" clauses) a lot,
   * but requires the Perl Procedural Language to be installed on your
   * Postgres server.
   */
  usePlperl: boolean;
  /**
   * Allow Persistent Connections
   * Allow connections to persist, if that is how PHP is configured.
   */
  allowPersistent: boolean;
}
