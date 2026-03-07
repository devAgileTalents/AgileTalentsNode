import { pool } from '../index';
import { ReviewDB } from '../../types/db.types';
import { Review, ReviewFilters } from '../../types/types';

function transformReview(db: ReviewDB): Review {
  return {
    id: db.id,
    rating: db.rating,
    reviewerCompanyLogo: db.reviewer_company_logo,
    reviewText: db.review_text,
    reviewerPhoto: db.reviewer_photo,
    reviewerFullName: db.reviewer_full_name,
    reviewerProfession: db.reviewer_profession,
    reviewTrustPilotLink: db.review_trustpilot_link,
  };
}

export const getReviews = async (
  page: number,
  limit: number,
  filters?: ReviewFilters,
): Promise<{ data: Review[]; total: number }> => {
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
        review_text ILIKE ${p}
        OR reviewer_full_name ILIKE ${p}
        OR reviewer_profession ILIKE ${p}
      )
    `);
  }

  if (typeof filters?.rating === 'number' && !Number.isNaN(filters.rating)) {
    params.push(filters.rating);
    whereParts.push(`rating = $${params.length}`);
  }

  if (filters?.reviewer) {
    const p = pushLike(filters.reviewer);
    whereParts.push(`
      (
        reviewer_full_name ILIKE ${p}
        OR reviewer_profession ILIKE ${p}
      )
    `);
  }

  if (filters?.text) {
    const p = pushLike(filters.text);
    whereParts.push(`review_text ILIKE ${p}`);
  }

  const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  params.push(limit);
  const limitParam = `$${params.length}`;
  params.push(offset);
  const offsetParam = `$${params.length}`;

  const dataQuery = `
    SELECT *
    FROM reviews
    ${whereClause}
    ORDER BY id DESC
    LIMIT ${limitParam} OFFSET ${offsetParam}
  `;

  const countParams = params.slice(0, -2);

  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM reviews
    ${whereClause}
  `;

  const [dataResult, countResult] = await Promise.all([
    pool.query<ReviewDB>(dataQuery, params),
    pool.query<{ total: number }>(countQuery, countParams),
  ]);

  return {
    data: dataResult.rows.map(transformReview),
    total: countResult.rows[0].total,
  };
};

export const getReviewById = async (id: number): Promise<Review | null> => {
  const query = `
    SELECT *
    FROM reviews
    WHERE id = $1
  `;

  const result = await pool.query<ReviewDB>(query, [id]);

  if (result.rows.length === 0) {
    return null;
  }

  return transformReview(result.rows[0]);
};

export const createReview = async (data: Omit<Review, 'id'>): Promise<Review> => {
  const query = `
    INSERT INTO reviews (
      rating,
      reviewer_company_logo,
      review_text,
      reviewer_photo,
      reviewer_full_name,
      reviewer_profession,
      review_trustpilot_link
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;

  const values = [
    data.rating,
    data.reviewerCompanyLogo,
    data.reviewText,
    data.reviewerPhoto,
    data.reviewerFullName,
    data.reviewerProfession,
    data.reviewTrustPilotLink,
  ];

  const result = await pool.query<ReviewDB>(query, values);
  return transformReview(result.rows[0]);
};

export const updateReview = async (id: number, data: Partial<Review>): Promise<Review | null> => {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (data.rating !== undefined) {
    fields.push(`rating = $${paramIndex++}`);
    values.push(data.rating);
  }
  if (data.reviewerCompanyLogo !== undefined) {
    fields.push(`reviewer_company_logo = $${paramIndex++}`);
    values.push(data.reviewerCompanyLogo);
  }
  if (data.reviewText !== undefined) {
    fields.push(`review_text = $${paramIndex++}`);
    values.push(data.reviewText);
  }
  if (data.reviewerPhoto !== undefined) {
    fields.push(`reviewer_photo = $${paramIndex++}`);
    values.push(data.reviewerPhoto);
  }
  if (data.reviewerFullName !== undefined) {
    fields.push(`reviewer_full_name = $${paramIndex++}`);
    values.push(data.reviewerFullName);
  }
  if (data.reviewerProfession !== undefined) {
    fields.push(`reviewer_profession = $${paramIndex++}`);
    values.push(data.reviewerProfession);
  }
  if (data.reviewTrustPilotLink !== undefined) {
    fields.push(`review_trustpilot_link = $${paramIndex++}`);
    values.push(data.reviewTrustPilotLink);
  }

  if (fields.length === 0) {
    return getReviewById(id);
  }

  values.push(id);

  const query = `
    UPDATE reviews
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  const result = await pool.query<ReviewDB>(query, values);

  if (result.rows.length === 0) {
    return null;
  }

  return transformReview(result.rows[0]);
};

export const deleteReview = async (id: number): Promise<boolean> => {
  const query = `
    DELETE FROM reviews
    WHERE id = $1
    RETURNING id
  `;

  const result = await pool.query(query, [id]);
  return result.rowCount !== null && result.rowCount > 0;
};
