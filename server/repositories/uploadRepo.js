/**
 * LoopBridge — Upload Repository
 *
 * Pure data-access for the uploads table.
 */
'use strict';

const { db } = require('../db');

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

    async findById(id) {
        return await db.queryRow('SELECT * FROM uploads WHERE id = ?', [id]);
    },

    async findByIdFormatted(id) {
        return rowToUpload(await this.findById(id));
    },

    async list({ type, limit } = {}) {
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

        const { rows } = await db.query(sql);
        return rows.map(rowToUpload);
    },

    async create({ id, filename, originalName, mimeType, size, path, url, uploadedBy }) {
        await db.runNamed(`
            INSERT INTO uploads (id, filename, original_name, mime_type, size, path, url, uploaded_by)
            VALUES (@id, @filename, @original_name, @mime_type, @size, @path, @url, @uploaded_by)
        `, {
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

    async deleteById(id) {
        await db.run('DELETE FROM uploads WHERE id = ?', [id]);
    }
};

module.exports = uploadRepo;
