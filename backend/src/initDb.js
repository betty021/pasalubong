// Patakbuhin: npm run db:init  (gagawa ng mga table)
import { readFileSync } from 'node:fs';
import { pool } from './db.js';

const sql = readFileSync(new URL('../sql/schema.sql', import.meta.url), 'utf8');
await pool.query(sql);
console.log('Tapos na: nagawa na ang mga table.');
await pool.end();
