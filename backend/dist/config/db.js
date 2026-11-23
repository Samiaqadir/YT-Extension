import pg from 'pg';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();
const { Pool } = pg;
class DatabaseManager {
    pgPool = null;
    sqliteDb = null;
    isPostgres = false;
    initialized = false;
    constructor() {
        // Initialized asynchronously
    }
    async init() {
        if (this.initialized)
            return;
        const dbUrl = process.env.DATABASE_URL;
        const forceSqlite = process.env.USE_SQLITE_FALLBACK === 'true';
        if (dbUrl && !forceSqlite) {
            try {
                console.log('[Database] Attempting connection to PostgreSQL...');
                const pool = new Pool({
                    connectionString: dbUrl,
                    connectionTimeoutMillis: 3000,
                });
                const client = await pool.connect();
                client.release();
                this.pgPool = pool;
                this.isPostgres = true;
                console.log('[Database] Connected successfully to PostgreSQL.');
                await this.runSchemaPostgres();
                this.initialized = true;
                return;
            }
            catch (err) {
                console.warn(`[Database] PostgreSQL connection failed (${err.message}). Falling back to SQLite for seamless execution.`);
            }
        }
        // SQLite Fallback - Fixed path resolution to backend/database
        const currentDir = path.dirname(fileURLToPath(import.meta.url));
        const dbDir = path.resolve(currentDir, '../../database');
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        const dbFilePath = path.join(dbDir, 'flow_sessions.sqlite');
        console.log(`[Database] Initializing SQLite database at ${dbFilePath}`);
        await new Promise((resolve, reject) => {
            this.sqliteDb = new sqlite3.Database(dbFilePath, (err) => {
                if (err) {
                    console.error('[Database] Failed to open SQLite database:', err);
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
        await this.runSchemaSqlite();
        this.initialized = true;
    }
    async runSchemaPostgres() {
        if (!this.pgPool)
            return;
        const schemaSql = `
      CREATE TABLE IF NOT EXISTS session_invitations (
        id VARCHAR(64) PRIMARY KEY,
        owner_id VARCHAR(64) NOT NULL,
        owner_label VARCHAR(128) NOT NULL,
        domain VARCHAR(255) NOT NULL,
        delegated_scope VARCHAR(64) NOT NULL DEFAULT 'read_write',
        recipient_email VARCHAR(255),
        recipient_passcode_hash VARCHAR(128),
        token_hash VARCHAR(128) UNIQUE NOT NULL,
        encrypted_payload TEXT NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        claimed_at TIMESTAMP WITH TIME ZONE,
        claimed_by VARCHAR(128),
        revoked_at TIMESTAMP WITH TIME ZONE,
        max_uses INT NOT NULL DEFAULT 1,
        use_count INT NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(64) PRIMARY KEY,
        invitation_id VARCHAR(64),
        event_type VARCHAR(64) NOT NULL,
        actor_id VARCHAR(128) NOT NULL,
        domain VARCHAR(255) NOT NULL,
        ip_address VARCHAR(64),
        user_agent TEXT,
        details TEXT,
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS delegated_session_grants (
        grant_id VARCHAR(64) PRIMARY KEY,
        invitation_id VARCHAR(64) REFERENCES session_invitations(id) ON DELETE CASCADE,
        domain VARCHAR(255) NOT NULL,
        grantee_id VARCHAR(128) NOT NULL,
        delegated_token VARCHAR(512) NOT NULL,
        scope VARCHAR(64) NOT NULL,
        is_valid BOOLEAN NOT NULL DEFAULT TRUE,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS managed_users (
        id VARCHAR(64) PRIMARY KEY,
        username VARCHAR(128) UNIQUE NOT NULL,
        password_hash VARCHAR(128) NOT NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'creator',
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP WITH TIME ZONE
      );
    `;
        await this.pgPool.query(schemaSql);
    }
    async runSchemaSqlite() {
        if (!this.sqliteDb)
            return;
        const schemaSql = `
      CREATE TABLE IF NOT EXISTS session_invitations (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        owner_label TEXT NOT NULL,
        domain TEXT NOT NULL,
        delegated_scope TEXT NOT NULL DEFAULT 'read_write',
        recipient_email TEXT,
        recipient_passcode_hash TEXT,
        token_hash TEXT UNIQUE NOT NULL,
        encrypted_payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
        claimed_at TEXT,
        claimed_by TEXT,
        revoked_at TEXT,
        max_uses INTEGER NOT NULL DEFAULT 1,
        use_count INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        invitation_id TEXT,
        event_type TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        domain TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        details TEXT,
        timestamp TEXT NOT NULL DEFAULT (DATETIME('now'))
      );

      CREATE TABLE IF NOT EXISTS delegated_session_grants (
        grant_id TEXT PRIMARY KEY,
        invitation_id TEXT REFERENCES session_invitations(id) ON DELETE CASCADE,
        domain TEXT NOT NULL,
        grantee_id TEXT NOT NULL,
        delegated_token TEXT NOT NULL,
        scope TEXT NOT NULL,
        is_valid INTEGER NOT NULL DEFAULT 1,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
      );

      CREATE TABLE IF NOT EXISTS managed_users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'creator',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
        last_login_at TEXT
      );
    `;
        return new Promise((resolve, reject) => {
            this.sqliteDb.exec(schemaSql, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async query(sql, params = []) {
        if (!this.initialized) {
            await this.init();
        }
        if (this.isPostgres && this.pgPool) {
            const res = await this.pgPool.query(sql, params);
            return {
                rows: res.rows,
                rowCount: res.rowCount ?? res.rows.length,
            };
        }
        if (this.sqliteDb) {
            let sqliteSql = sql;
            const orderedParams = [...params];
            sqliteSql = sqliteSql.replace(/\$(\d+)/g, '?');
            const isSelect = /^\s*SELECT/i.test(sqliteSql);
            return new Promise((resolve, reject) => {
                if (isSelect) {
                    this.sqliteDb.all(sqliteSql, orderedParams, (err, rows) => {
                        if (err)
                            reject(err);
                        else
                            resolve({ rows: (rows || []), rowCount: (rows || []).length });
                    });
                }
                else {
                    this.sqliteDb.run(sqliteSql, orderedParams, function (err) {
                        if (err)
                            reject(err);
                        else
                            resolve({ rows: [], rowCount: this.changes || 0 });
                    });
                }
            });
        }
        throw new Error('Database is not initialized.');
    }
}
export const db = new DatabaseManager();
