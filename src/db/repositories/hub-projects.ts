import { pool } from '../index';
import { HubProjectDB, SqlParam } from '../../types/db.types';
import { HubProjectResponse, HubProjectFilters } from '../../types/types';
import { handleRepositoryError } from '../../lib/errors/repository-error';

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function getAccessUserIds(projectId: number): Promise<number[]> {
  const res = await pool.query<{ user_id: number }>(
    'SELECT user_id FROM hub_project_access WHERE project_id = $1 ORDER BY user_id',
    [projectId],
  );
  return res.rows.map((r) => r.user_id);
}

function transformProject(db: HubProjectDB, access: number[]): HubProjectResponse {
  const result: HubProjectResponse = {
    id: db.id,
    name: db.name,
    clientId: db.client_id,
    title: db.title,
    startDate: formatDate(db.start_date),
    weeklyTarget: db.weekly_target,
    access,
    contractedType: db.contracted_type,
  };
  if (db.end_date) result.endDate = formatDate(db.end_date);
  if (db.contracted_hours != null) result.contractedHours = db.contracted_hours;
  return result;
}

// ── LIST ──────────────────────────────────────────────────
export const getHubProjects = async (
  page: number,
  limit: number,
  filters?: HubProjectFilters,
): Promise<{ data: HubProjectResponse[]; total: number }> => {
  try {
    const offset = (page - 1) * limit;
    const params: SqlParam[] = [];
    const whereParts: string[] = [];

    if (filters?.search) {
      params.push(`%${filters.search}%`);
      const p = `$${params.length}`;
      whereParts.push(`(name ILIKE ${p} OR title ILIKE ${p})`);
    }
    if (filters?.clientId) {
      params.push(filters.clientId);
      whereParts.push(`client_id = $${params.length}`);
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    params.push(limit);
    const limitP = `$${params.length}`;
    params.push(offset);
    const offsetP = `$${params.length}`;

    const [dataRes, countRes] = await Promise.all([
      pool.query<HubProjectDB>(
        `SELECT * FROM hub_projects ${whereClause} ORDER BY id LIMIT ${limitP} OFFSET ${offsetP}`,
        params,
      ),
      pool.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM hub_projects ${whereClause}`,
        params.slice(0, -2),
      ),
    ]);

    const projects: HubProjectResponse[] = [];
    for (const row of dataRes.rows) {
      const access = await getAccessUserIds(row.id);
      projects.push(transformProject(row, access));
    }

    return { data: projects, total: countRes.rows[0]?.total ?? 0 };
  } catch (error) {
    handleRepositoryError('getHubProjects', error);
  }
};

// ── GET ALL (no pagination) ──────────────────────────────
export const getAllHubProjects = async (): Promise<HubProjectResponse[]> => {
  try {
    const dataRes = await pool.query<HubProjectDB>('SELECT * FROM hub_projects ORDER BY id');
    const projects: HubProjectResponse[] = [];
    for (const row of dataRes.rows) {
      const access = await getAccessUserIds(row.id);
      projects.push(transformProject(row, access));
    }
    return projects;
  } catch (error) {
    handleRepositoryError('getAllHubProjects', error);
  }
};

// ── GET BY ID ─────────────────────────────────────────────
export const getHubProjectById = async (id: number): Promise<HubProjectResponse | null> => {
  try {
    const res = await pool.query<HubProjectDB>('SELECT * FROM hub_projects WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    const access = await getAccessUserIds(id);
    return transformProject(res.rows[0], access);
  } catch (error) {
    handleRepositoryError('getHubProjectById', error);
  }
};

// ── CREATE ────────────────────────────────────────────────
export const createHubProject = async (data: any): Promise<HubProjectResponse> => {
  try {
    const res = await pool.query<HubProjectDB>(
      `INSERT INTO hub_projects (name, client_id, title, start_date, end_date, weekly_target, contracted_type, contracted_hours)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        data.name,
        data.clientId,
        data.title ?? '',
        data.startDate,
        data.endDate ?? null,
        data.weeklyTarget ?? 40,
        data.contractedType ?? 'Full-time',
        data.contractedHours ?? null,
      ],
    );

    const project = res.rows[0];

    // Insert access entries
    if (Array.isArray(data.access)) {
      for (const userId of data.access) {
        await pool.query(
          'INSERT INTO hub_project_access (project_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [project.id, userId],
        );
      }
    }

    const access = await getAccessUserIds(project.id);
    return transformProject(project, access);
  } catch (error) {
    handleRepositoryError('createHubProject', error);
  }
};

// ── UPDATE ────────────────────────────────────────────────
export const updateHubProject = async (id: number, data: any): Promise<HubProjectResponse | null> => {
  try {
    const fields: string[] = [];
    const values: SqlParam[] = [];
    let idx = 1;

    const map: Record<string, string> = {
      name: 'name',
      clientId: 'client_id',
      title: 'title',
      startDate: 'start_date',
      endDate: 'end_date',
      weeklyTarget: 'weekly_target',
      contractedType: 'contracted_type',
      contractedHours: 'contracted_hours',
    };

    for (const [key, col] of Object.entries(map)) {
      if (data[key] !== undefined) {
        fields.push(`${col} = $${idx++}`);
        values.push(data[key]);
      }
    }

    if (fields.length > 0) {
      values.push(id);
      const res = await pool.query<HubProjectDB>(
        `UPDATE hub_projects SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values,
      );
      if (res.rows.length === 0) return null;
    }

    // Update access if provided
    if (Array.isArray(data.access)) {
      await pool.query('DELETE FROM hub_project_access WHERE project_id = $1', [id]);
      for (const userId of data.access) {
        await pool.query(
          'INSERT INTO hub_project_access (project_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, userId],
        );
      }
    }

    return await getHubProjectById(id);
  } catch (error) {
    handleRepositoryError('updateHubProject', error);
  }
};

// ── DELETE ────────────────────────────────────────────────
export const deleteHubProject = async (id: number): Promise<boolean> => {
  try {
    const res = await pool.query('DELETE FROM hub_projects WHERE id = $1 RETURNING id', [id]);
    return (res.rowCount ?? 0) > 0;
  } catch (error) {
    handleRepositoryError('deleteHubProject', error);
  }
};
