/**
 * LoopBridge — Upload Repository
 *
 * Pure data-access for the uploads table.
 */
'use strict';

const { getDb } = require('../db');

function rowToUpload(row) {
    if (!row) return null;
    return {
        id: row.id,
        filename: row.filename,
        originalName: row.original_name,
        mimeType: row.mime_type,
        size: row.size,
        path: row.path,
        url: row.url,
        uploadedBy: row.uploaded_by,
        createdAt: row.created_at
    };
}

const uploadRepo = {
    rowToUpload,

    findById(id) {
        const row = getDb().prepare('SELECT * FROM uploads WHERE id = ?').get(id);
        return row || null;
    },

    findByIdFormatted(id) {
        return rowToUpload(this.findById(id));
    },

    list({ type, limit } = {}) {
        let sql = 'SELECT * FROM uploads';

        if (type === 'image') {
            sql += " WHERE mime_type LIKE 'image/%'";
        } else if (type === 'video') {
            sql += " WHERE mime_type LIKE 'video/%'";
        } else if (type === 'audio') {
            sql += " WHERE mime_type LIKE 'audio/%'";
        }

        sql += ' ORDER BY created_at DESC';

        if (limit) {
            sql += ` LIMIT ${parseInt(limit, 10)}`;
        }

        return getDb().prepare(sql).all().map(rowToUpload);
    },

    create({ id, filename, originalName, mimeType, size, path, url, uploadedBy }) {
        getDb().prepare(`
            INSERT INTO uploads (id, filename, original_name, mime_type, size, path, url, uploaded_by)
            VALUES (@id, @filename, @original_name, @mime_type, @size, @path, @url, @uploaded_by)
        `).run({
            id,
            filename,
            original_name: originalName,
            mime_type: mimeType,
            size,
            path,
            url,
            uploaded_by: uploadedBy
        });
        return this.findByIdFormatted(id);
    },

    deleteById(id) {
        getDb().prepare('DELETE FROM uploads WHERE id = ?').run(id);
    }
};

module.exports = uploadRepo;
