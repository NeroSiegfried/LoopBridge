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
        createdAt: row.created_at,
        hlsUrl: row.hls_url || null,
        thumbnailUrl: row.thumbnail_url || null,
        transcodeJobId: row.transcode_job_id || null,
        transcodeStatus: row.transcode_status || 'none',
        transcodeError: row.transcode_error || null,
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
    },

    async updateTranscodeStatus(id, { transcodeJobId, hlsUrl, thumbnailUrl, transcodeStatus, transcodeError }) {
        const sets = [];
        const params = { id };

        if (transcodeJobId !== undefined)  { sets.push('transcode_job_id = @transcode_job_id'); params.transcode_job_id = transcodeJobId; }
        if (hlsUrl !== undefined)          { sets.push('hls_url = @hls_url');                   params.hls_url = hlsUrl; }
        if (thumbnailUrl !== undefined)    { sets.push('thumbnail_url = @thumbnail_url');       params.thumbnail_url = thumbnailUrl; }
        if (transcodeStatus !== undefined) { sets.push('transcode_status = @transcode_status'); params.transcode_status = transcodeStatus; }
        if (transcodeError !== undefined)  { sets.push('transcode_error = @transcode_error');   params.transcode_error = transcodeError; }

        if (sets.length === 0) return;

        await db.runNamed(`UPDATE uploads SET ${sets.join(', ')} WHERE id = @id`, params);
    },
};

module.exports = uploadRepo;
