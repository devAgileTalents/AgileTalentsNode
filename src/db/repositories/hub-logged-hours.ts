import { pool } from '../index';
import { HubLoggedHourDB, SqlParam } from '../../types/db.types';
import { HubUserLoggedHour } from '../../types/types';
import { handleRepositoryError } from '../../lib/errors/repository-error';

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function transform(db: HubLoggedHourDB): HubUserLoggedHour {
  return {
    id: db.id,
    date: formatDate(db.date),
    hours: Number(db.hours),
    task: db.task,
    projectId: db.project_id,
  };
}

export const getLoggedHoursByUser = async (userId: number): Promise<HubUserLoggedHour[]> => {
  try {
    const res = await pool.query<HubLoggedHourDB>(
      'SELECT * FROM hub_logged_hours WHERE user_id = $1 ORDER BY date DESC',
      [userId],
    );
    return res.rows.map(transform);
  } catch (error) {
    handleRepositoryError('getLoggedHoursByUser', error);
  }
};

export const createLoggedHour = async (userId: number, data: any): Promise<HubUserLoggedHour> => {
  try {
    const res = await pool.query<HubLoggedHourDB>(
      `INSERT INTO hub_logged_hours (user_id, project_id, date, hours, task)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [userId, data.projectId, data.date, data.hours, data.task ?? ''],
    );
    return transform(res.rows[0]);
  } catch (error) {
    handleRepositoryError('createLoggedHour', error);
  }
};

export const updateLoggedHour = async (id: number, data: any): Promise<HubUserLoggedHour | null> => {
  try {
    const fields: string[] = [];
    const values: SqlParam[] = [];
    let idx = 1;

    if (data.projectId !== undefined) { fields.push(`project_id = $${idx++}`); values.push(data.projectId); }
    if (data.date !== undefined) { fields.push(`date = $${idx++}`); values.push(data.date); }
    if (data.hours !== undefined) { fields.push(`hours = $${idx++}`); values.push(data.hours); }
    if (data.task !== undefined) { fields.push(`task = $${idx++}`); values.push(data.task); }

    if (fields.length === 0) return null;

    values.push(id);
    const res = await pool.query<HubLoggedHourDB>(
      `UPDATE hub_logged_hours SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    );
    return res.rows.length ? transform(res.rows[0]) : null;
  } catch (error) {
    handleRepositoryError('updateLoggedHour', error);
  }
};

export const deleteLoggedHour = async (id: number): Promise<boolean> => {
  try {
    const res = await pool.query('DELETE FROM hub_logged_hours WHERE id = $1 RETURNING id', [id]);
    return (res.rowCount ?? 0) > 0;
  } catch (error) {
    handleRepositoryError('deleteLoggedHour', error);
  }
};
