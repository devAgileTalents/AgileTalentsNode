import { pool } from '../index';
import { FreelancerDB, SqlParam } from '../../types/db.types';
import { Freelancer, FreelancerFilters } from '../../types/types';
import { handleRepositoryError } from '../../lib/errors/repository-error';

function transformFreelancer(db: FreelancerDB): Freelancer {
  return {
    id: db.id,
    imageUrl: db.image_url,
    fullName: db.full_name,
    profession: db.profession,
    hourlyRate: db.hourly_rate,
    experience: db.experience,
    technologies: db.technologies,
  };
}

export const getFreelancers = async (
  page: number,
  limit: number,
  filters?: FreelancerFilters,
): Promise<{ data: Freelancer[]; total: number }> => {
  try {
    const offset = (page - 1) * limit;

    const params: SqlParam[] = [];
    const whereParts: string[] = [];

    const pushLike = (value: string): string => {
      params.push(`%${value}%`);
      return `$${params.length}`;
    };

    if (filters?.search) {
      const p = pushLike(filters.search);
      whereParts.push(`
        (
          full_name ILIKE ${p}
          OR profession ILIKE ${p}
          OR EXISTS (
            SELECT 1
            FROM unnest(technologies) t
            WHERE t ILIKE ${p}
          )
        )
      `);
    }

    if (filters?.name) {
      const p = pushLike(filters.name);
      whereParts.push(`full_name ILIKE ${p}`);
    }

    if (filters?.profession) {
      const p = pushLike(filters.profession);
      whereParts.push(`profession ILIKE ${p}`);
    }

    if (filters?.tech) {
      const p = pushLike(filters.tech);
      whereParts.push(`
        EXISTS (
          SELECT 1
          FROM unnest(technologies) t
          WHERE t ILIKE ${p}
        )
      `);
    }

    if (typeof filters?.minRate === 'number' && !Number.isNaN(filters.minRate)) {
      params.push(filters.minRate);
      whereParts.push(`hourly_rate >= $${params.length}`);
    }

    if (typeof filters?.maxRate === 'number' && !Number.isNaN(filters.maxRate)) {
      params.push(filters.maxRate);
      whereParts.push(`hourly_rate <= $${params.length}`);
    }

    if (typeof filters?.minExp === 'number' && !Number.isNaN(filters.minExp)) {
      params.push(filters.minExp);
      whereParts.push(`experience >= $${params.length}`);
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    params.push(limit);
    const limitParam = `$${params.length}`;

    params.push(offset);
    const offsetParam = `$${params.length}`;

    const dataQuery = `
      SELECT *
      FROM freelancers
      ${whereClause}
      ORDER BY id
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM freelancers
      ${whereClause}
    `;

    const countParams = params.slice(0, -2);

    const [dataResult, countResult] = await Promise.all([
      pool.query<FreelancerDB>(dataQuery, params),
      pool.query<{ total: number }>(countQuery, countParams),
    ]);

    return {
      data: dataResult.rows.map(transformFreelancer),
      total: countResult.rows[0]?.total ?? 0,
    };
  } catch (error) {
    handleRepositoryError('getFreelancers', error);
  }
};

export const getFreelancerById = async (id: number): Promise<Freelancer | null> => {
  try {
    const query = `
      SELECT *
      FROM freelancers
      WHERE id = $1
    `;

    const result = await pool.query<FreelancerDB>(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return transformFreelancer(result.rows[0]);
  } catch (error) {
    handleRepositoryError('getFreelancerById', error);
  }
};

export const createFreelancer = async (data: Omit<Freelancer, 'id'>): Promise<Freelancer> => {
  try {
    const query = `
      INSERT INTO freelancers (
        image_url,
        full_name,
        profession,
        hourly_rate,
        experience,
        technologies
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values: SqlParam[] = [
      data.imageUrl,
      data.fullName,
      data.profession,
      data.hourlyRate,
      data.experience,
      data.technologies,
    ];

    const result = await pool.query<FreelancerDB>(query, values);
    return transformFreelancer(result.rows[0]);
  } catch (error) {
    handleRepositoryError('createFreelancer', error);
  }
};

export const updateFreelancer = async (
  id: number,
  data: Partial<Freelancer>,
): Promise<Freelancer | null> => {
  try {
    const fields: string[] = [];
    const values: SqlParam[] = [];
    let paramIndex = 1;

    if (data.imageUrl !== undefined) {
      fields.push(`image_url = $${paramIndex++}`);
      values.push(data.imageUrl);
    }

    if (data.fullName !== undefined) {
      fields.push(`full_name = $${paramIndex++}`);
      values.push(data.fullName);
    }

    if (data.profession !== undefined) {
      fields.push(`profession = $${paramIndex++}`);
      values.push(data.profession);
    }

    if (data.hourlyRate !== undefined) {
      fields.push(`hourly_rate = $${paramIndex++}`);
      values.push(data.hourlyRate);
    }

    if (data.experience !== undefined) {
      fields.push(`experience = $${paramIndex++}`);
      values.push(data.experience);
    }

    if (data.technologies !== undefined) {
      fields.push(`technologies = $${paramIndex++}`);
      values.push(data.technologies);
    }

    if (fields.length === 0) {
      return await getFreelancerById(id);
    }

    values.push(id);

    const query = `
      UPDATE freelancers
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query<FreelancerDB>(query, values);

    if (result.rows.length === 0) {
      return null;
    }

    return transformFreelancer(result.rows[0]);
  } catch (error) {
    handleRepositoryError('updateFreelancer', error);
  }
};

export const deleteFreelancer = async (id: number): Promise<boolean> => {
  try {
    const query = `
      DELETE FROM freelancers
      WHERE id = $1
      RETURNING id
    `;

    const result = await pool.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    handleRepositoryError('deleteFreelancer', error);
  }
};
