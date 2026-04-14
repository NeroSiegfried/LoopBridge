#!/usr/bin/env node
/**
 * One-time migration script:
 * Updates upload records with their actual HLS URLs for existing transcoded files.
 * Run inside the Docker container: node server/scripts/fix-hls-urls.js
 */
'use strict';

const Database = require('better-sqlite3');
const dbPath = process.env.DB_PATH || '/data/loopbridge.db';
const bucket = process.env.S3_BUCKET || 'loopbridge-uploads-680128294518';
const region = process.env.S3_REGION || 'us-east-1';

const db = new Database(dbPath);

const updates = [
    {
        id: '307b4a21-a41f-4e1f-98f6-48a3fe30efe5',
        hls_url: `https://${bucket}.s3.${region}.amazonaws.com/transcoded/307b4a21-a41f-4e1f-98f6-48a3fe30efe5/307b4a21-a41f-4e1f-98f6-48a3fe30efe5-98a1b6a3b7814b2da91205b874f78ad7.m3u8`,
        transcode_status: 'COMPLETE',
    },
    {
        id: 'f81c7eb4-8553-4e75-b368-8f13f7ec03d2',
        hls_url: `https://${bucket}.s3.${region}.amazonaws.com/transcoded/f81c7eb4-8553-4e75-b368-8f13f7ec03d2/f81c7eb4-8553-4e75-b368-8f13f7ec03d2-anagrams-webapp-demo.m3u8`,
        transcode_status: 'COMPLETE',
    },
];

const stmt = db.prepare('UPDATE uploads SET hls_url = ?, transcode_status = ? WHERE id = ?');

for (const u of updates) {
    const info = stmt.run(u.hls_url, u.transcode_status, u.id);
    console.log(`Updated ${u.id}: ${info.changes} row(s)`);
}

// Verify
const rows = db.prepare('SELECT id, hls_url, transcode_status FROM uploads').all();
console.log('\nCurrent state:');
console.log(JSON.stringify(rows, null, 2));

db.close();
console.log('Done.');
