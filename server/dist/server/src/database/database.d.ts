import sqlite3 from 'sqlite3';
export declare const db: sqlite3.Database;
export declare const initializeDatabase: () => Promise<void>;
export declare const runQuery: (sql: string, params?: any[]) => Promise<sqlite3.RunResult>;
export declare const getQuery: <T>(sql: string, params?: any[]) => Promise<T | undefined>;
export declare const allQuery: <T>(sql: string, params?: any[]) => Promise<T[]>;
export declare const closeDatabase: () => Promise<void>;
//# sourceMappingURL=database.d.ts.map