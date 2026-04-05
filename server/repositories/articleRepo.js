/**
 * LoopBridge — Article Repository
 *
 * Pure data-access for the articles table.
 */
'use strict';

const { getDb } = require('../db');

function rowToArticle(row) {
    if (!row) return null;
    return {
        id: row.id,
        title: row.title,
        slug: row.slug,
        description: row.description,
        category: row.category,
        image: row.image,
        author: {
            name: row.author_name || 'LoopBridge Team',
            avatar: row.author_avatar || null
        },
        readTime: row.read_time,
        publishedAt: row.published_at,
        updatedAt: row.updated_at,
        createdAt: row.created_at,
        featured: !!row.featured,
        deleted: !!row.deleted,
        deletedAt: row.deleted_at,
        content: JSON.parse(row.content || '[]'),
        views: row.views || 0
    };
}

const articleRepo = {
    rowToArticle,

    findById(id) {
        const row = getDb().prepare('SELECT * FROM articles WHERE id = ?').get(id);
        return row || null;
    },

    findByIdFormatted(id) {
        return rowToArticle(this.findById(id));
    },

    list({ category, featured, includeDeleted } = {}) {
        let sql = 'SELECT * FROM articles';
        const conditions = [];
        const params = {};

        if (!includeDeleted) {
            conditions.push('deleted = 0');
        }
        if (category && category !== 'All') {
            conditions.push('category = @category');
            params.category = category;
        }
        if (featured) {
            conditions.push('featured = 1');
        }
        if (conditions.length) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }
        sql += ' ORDER BY published_at DESC';

        return getDb().prepare(sql).all(params).map(rowToArticle);
    },

    create(data) {
        const now = new Date().toISOString();
        getDb().prepare(`
            INSERT INTO articles
                (id, title, slug, description, category, image,
                 author_name, author_avatar, read_time,
                 published_at, updated_at, created_at, featured, content)
            VALUES
                (@id, @title, @slug, @description, @category, @image,
                 @author_name, @author_avatar, @read_time,
                 @published_at, @updated_at, @created_at, @featured, @content)
        `).run({
            id: data.id,
            title: data.title || 'Untitled',
            slug: data.slug || null,
            description: data.description || null,
            category: data.category || null,
            image: data.image || null,
            author_name: data.authorName,
            author_avatar: data.authorAvatar || null,
            read_time: data.readTime || null,
            published_at: data.publishedAt || now,
            updated_at: now,
            created_at: now,
            featured: data.featured ? 1 : 0,
            content: JSON.stringify(data.content || [])
        });
        return this.findByIdFormatted(data.id);
    },

    update(id, data) {
        const existing = this.findById(id);
        if (!existing) return null;

        const now = new Date().toISOString();
        getDb().prepare(`
            UPDATE articles SET
                title = @title, slug = @slug, description = @description,
                category = @category, image = @image,
                author_name = @author_name, author_avatar = @author_avatar,
                read_time = @read_time, published_at = @published_at,
                updated_at = @updated_at, featured = @featured, content = @content
            WHERE id = @id
        `).run({
            id,
            title: data.title !== undefined ? data.title : existing.title,
            slug: data.slug !== undefined ? data.slug : existing.slug,
            description: data.description !== undefined ? data.description : existing.description,
            category: data.category !== undefined ? data.category : existing.category,
            image: data.image !== undefined ? data.image : existing.image,
            author_name: data.authorName !== undefined ? data.authorName : existing.author_name,
            author_avatar: data.authorAvatar !== undefined ? data.authorAvatar : existing.author_avatar,
            read_time: data.readTime !== undefined ? data.readTime : existing.read_time,
            published_at: data.publishedAt !== undefined ? data.publishedAt : existing.published_at,
            updated_at: now,
            featured: data.featured !== undefined ? (data.featured ? 1 : 0) : existing.featured,
            content: data.content !== undefined ? JSON.stringify(data.content) : existing.content
        });
        return this.findByIdFormatted(id);
    },

    softDelete(id) {
        const now = new Date().toISOString();
        getDb().prepare('UPDATE articles SET deleted = 1, deleted_at = ? WHERE id = ?')
            .run(now, id);
    },

    restore(id) {
        getDb().prepare('UPDATE articles SET deleted = 0, deleted_at = NULL WHERE id = ?')
            .run(id);
        return this.findByIdFormatted(id);
    },

    incrementViews(id) {
        getDb().prepare('UPDATE articles SET views = views + 1 WHERE id = ?').run(id);
    },

    /**
     * List articles the given author owns (by id list).
     * Includes deleted items so the dashboard can show them.
     */
    listByAuthorIds(articleIds) {
        if (!articleIds || articleIds.length === 0) return [];
        const placeholders = articleIds.map(() => '?').join(',');
        const sql = `SELECT * FROM articles WHERE id IN (${placeholders}) ORDER BY published_at DESC`;
        return getDb().prepare(sql).all(...articleIds).map(rowToArticle);
    },

    listByAuthorName(authorName) {
        return getDb().prepare(
            'SELECT * FROM articles WHERE author_name = ? ORDER BY published_at DESC'
        ).all(authorName).map(rowToArticle);
    }
};

module.exports = articleRepo;
