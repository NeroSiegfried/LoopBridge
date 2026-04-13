/**
 * LoopBridge — Course Repository
 *
 * Pure data-access for the courses table.
 */
'use strict';

const { db } = require('../db');

function rowToCourse(row) {
    if (!row) return null;
    return {
        id: row.id,
        title: row.title,
        slug: row.slug,
        description: row.description,
        image: row.image,
        author: {
            name: row.author_name || 'LoopBridge Team',
            avatar: row.author_avatar || null
        },
        duration: row.duration,
        level: row.level,
        track: row.track,
        price: row.price,
        publishedAt: row.published_at,
        updatedAt: row.updated_at,
        createdAt: row.created_at,
        approved: !!row.approved,
        deleted: !!row.deleted,
        deletedAt: row.deleted_at,
        topics: JSON.parse(row.topics || '[]'),
        overview: row.overview,
        learningObjectives: JSON.parse(row.learning_objectives || '[]')
    };
}

const courseRepo = {
    rowToCourse,

    async findById(id) {
        return await db.queryRow('SELECT * FROM courses WHERE id = ?', [id]);
    },

    async findByIdFormatted(id) {
        return rowToCourse(await this.findById(id));
    },

    async list({ track, includeDeleted } = {}) {
        let sql = 'SELECT * FROM courses';
        const conditions = [];
        const params = {};

        if (!includeDeleted) {
            conditions.push('deleted = 0');
            conditions.push('approved = 1');
        }
        if (track && track !== 'All') {
            conditions.push('track = @track');
            params.track = track;
        }
        if (conditions.length) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }
        sql += ' ORDER BY published_at DESC';

        const { rows } = await db.queryNamed(sql, params);
        return rows.map(rowToCourse);
    },

    async create(data) {
        const now = new Date().toISOString();
        await db.runNamed(`
            INSERT INTO courses
                (id, title, slug, description, image,
                 author_name, author_avatar, duration, level, track, price,
                 published_at, updated_at, created_at, approved,
                 topics, overview, learning_objectives)
            VALUES
                (@id, @title, @slug, @description, @image,
                 @author_name, @author_avatar, @duration, @level, @track, @price,
                 @published_at, @updated_at, @created_at, @approved,
                 @topics, @overview, @learning_objectives)
        `, {
            id: data.id,
            title: data.title || 'Untitled',
            slug: data.slug || null,
            description: data.description || null,
            image: data.image || null,
            author_name: data.authorName,
            author_avatar: data.authorAvatar || null,
            duration: data.duration || null,
            level: data.level || null,
            track: data.track || null,
            price: data.price || 0,
            published_at: data.publishedAt || now,
            updated_at: now,
            created_at: now,
            approved: data.approved !== false ? 1 : 0,
            topics: JSON.stringify(data.topics || []),
            overview: data.overview || null,
            learning_objectives: JSON.stringify(data.learningObjectives || [])
        });
        return this.findByIdFormatted(data.id);
    },

    async update(id, data) {
        const existing = await this.findById(id);
        if (!existing) return null;

        const now = new Date().toISOString();
        await db.runNamed(`
            UPDATE courses SET
                title = @title, slug = @slug, description = @description,
                image = @image, author_name = @author_name, author_avatar = @author_avatar,
                duration = @duration, level = @level, track = @track, price = @price,
                published_at = @published_at, updated_at = @updated_at,
                approved = @approved, topics = @topics,
                overview = @overview, learning_objectives = @learning_objectives
            WHERE id = @id
        `, {
            id,
            title: data.title !== undefined ? data.title : existing.title,
            slug: data.slug !== undefined ? data.slug : existing.slug,
            description: data.description !== undefined ? data.description : existing.description,
            image: data.image !== undefined ? data.image : existing.image,
            author_name: data.authorName !== undefined ? data.authorName : existing.author_name,
            author_avatar: data.authorAvatar !== undefined ? data.authorAvatar : existing.author_avatar,
            duration: data.duration !== undefined ? data.duration : existing.duration,
            level: data.level !== undefined ? data.level : existing.level,
            track: data.track !== undefined ? data.track : existing.track,
            price: data.price !== undefined ? data.price : existing.price,
            published_at: data.publishedAt !== undefined ? data.publishedAt : existing.published_at,
            updated_at: now,
            approved: data.approved !== undefined ? (data.approved ? 1 : 0) : existing.approved,
            topics: data.topics !== undefined ? JSON.stringify(data.topics) : existing.topics,
            overview: data.overview !== undefined ? data.overview : existing.overview,
            learning_objectives: data.learningObjectives !== undefined ? JSON.stringify(data.learningObjectives) : existing.learning_objectives
        });
        return this.findByIdFormatted(id);
    },

    async softDelete(id) {
        const now = new Date().toISOString();
        await db.run('UPDATE courses SET deleted = 1, deleted_at = ? WHERE id = ?', [now, id]);
    },

    async restore(id) {
        await db.run('UPDATE courses SET deleted = 0, deleted_at = NULL WHERE id = ?', [id]);
        return this.findByIdFormatted(id);
    },

    async listByAuthorName(authorName) {
        const { rows } = await db.query(
            'SELECT * FROM courses WHERE author_name = ? ORDER BY published_at DESC',
            [authorName]);
        return rows.map(rowToCourse);
    }
};

module.exports = courseRepo;
