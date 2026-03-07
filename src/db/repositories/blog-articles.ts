import { pool } from '../index';
import { BlogArticleDB } from '../../types/db.types';
import { BlogArticle, BlogArticleFilters } from '../../types/types';

function formatDateToString(date: Date): string {
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

function transformBlogArticle(db: BlogArticleDB): BlogArticle {
  return {
    id: db.id,
    imageArticleHref: db.image_article_href,
    title: db.title,
    description: db.description,
    photoAuthorHref: db.photo_author_href,
    authorFullName: db.author_full_name,
    publishDate: formatDateToString(db.publish_date),
  };
}

export const getBlogArticles = async (
  page: number,
  limit: number,
  filters?: BlogArticleFilters,
): Promise<{ data: BlogArticle[]; total: number }> => {
  const offset = (page - 1) * limit;

  const params: any[] = [];
  const whereParts: string[] = [];

  const pushLike = (value: string) => {
    params.push(`%${value}%`);
    return `$${params.length}`;
  };

  if (filters?.search) {
    const p = pushLike(filters.search);
    whereParts.push(`
      (
        title ILIKE ${p}
        OR description ILIKE ${p}
        OR author_full_name ILIKE ${p}
      )
    `);
  }

  if (filters?.title) {
    const p = pushLike(filters.title);
    whereParts.push(`title ILIKE ${p}`);
  }

  if (filters?.author) {
    const p = pushLike(filters.author);
    whereParts.push(`author_full_name ILIKE ${p}`);
  }

  // publish_date >= fromDate
  if (filters?.fromDate) {
    params.push(filters.fromDate);
    whereParts.push(`publish_date >= $${params.length}::date`);
  }

  // toDate включительно по дню: publish_date < (toDate + 1 day)
  if (filters?.toDate) {
    params.push(filters.toDate);
    whereParts.push(`publish_date < ($${params.length}::date + INTERVAL '1 day')`);
  }

  const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  params.push(limit);
  const limitParam = `$${params.length}`;
  params.push(offset);
  const offsetParam = `$${params.length}`;

  const dataQuery = `
    SELECT *
    FROM blog_articles
    ${whereClause}
    ORDER BY publish_date DESC, id DESC
    LIMIT ${limitParam} OFFSET ${offsetParam}
  `;

  const countParams = params.slice(0, -2);

  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM blog_articles
    ${whereClause}
  `;

  const [dataResult, countResult] = await Promise.all([
    pool.query<BlogArticleDB>(dataQuery, params),
    pool.query<{ total: number }>(countQuery, countParams),
  ]);

  return {
    data: dataResult.rows.map(transformBlogArticle),
    total: countResult.rows[0].total,
  };
};

export const getBlogArticleById = async (id: number): Promise<BlogArticle | null> => {
  const query = `
    SELECT *
    FROM blog_articles
    WHERE id = $1
  `;

  const result = await pool.query<BlogArticleDB>(query, [id]);

  if (result.rows.length === 0) {
    return null;
  }

  return transformBlogArticle(result.rows[0]);
};

export const createBlogArticle = async (data: Omit<BlogArticle, 'id'>): Promise<BlogArticle> => {
  const query = `
    INSERT INTO blog_articles (
      image_article_href,
      title,
      description,
      photo_author_href,
      author_full_name,
      publish_date
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;

  const values = [
    data.imageArticleHref,
    data.title,
    data.description,
    data.photoAuthorHref,
    data.authorFullName,
    new Date(data.publishDate), // Конвертируем строку обратно в дату
  ];

  const result = await pool.query<BlogArticleDB>(query, values);
  return transformBlogArticle(result.rows[0]);
};

export const updateBlogArticle = async (
  id: number,
  data: Partial<BlogArticle>,
): Promise<BlogArticle | null> => {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (data.imageArticleHref !== undefined) {
    fields.push(`image_article_href = $${paramIndex++}`);
    values.push(data.imageArticleHref);
  }
  if (data.title !== undefined) {
    fields.push(`title = $${paramIndex++}`);
    values.push(data.title);
  }
  if (data.description !== undefined) {
    fields.push(`description = $${paramIndex++}`);
    values.push(data.description);
  }
  if (data.photoAuthorHref !== undefined) {
    fields.push(`photo_author_href = $${paramIndex++}`);
    values.push(data.photoAuthorHref);
  }
  if (data.authorFullName !== undefined) {
    fields.push(`author_full_name = $${paramIndex++}`);
    values.push(data.authorFullName);
  }
  if (data.publishDate !== undefined) {
    fields.push(`publish_date = $${paramIndex++}`);
    values.push(new Date(data.publishDate));
  }

  if (fields.length === 0) {
    return getBlogArticleById(id);
  }

  values.push(id);

  const query = `
    UPDATE blog_articles
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  const result = await pool.query<BlogArticleDB>(query, values);

  if (result.rows.length === 0) {
    return null;
  }

  return transformBlogArticle(result.rows[0]);
};

export const deleteBlogArticle = async (id: number): Promise<boolean> => {
  const query = `
    DELETE FROM blog_articles
    WHERE id = $1
    RETURNING id
  `;

  const result = await pool.query(query, [id]);
  return result.rowCount !== null && result.rowCount > 0;
};
