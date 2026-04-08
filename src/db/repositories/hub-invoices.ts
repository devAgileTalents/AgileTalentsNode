import { pool } from '../index';
import { HubInvoiceDB } from '../../types/db.types';
import { HubUserInvoice } from '../../types/types';
import { handleRepositoryError } from '../../lib/errors/repository-error';

function transform(db: HubInvoiceDB): HubUserInvoice {
  return {
    id: db.id,
    projectId: db.project_id,
    month: db.month,
    generatedAt: db.generated_at.toISOString(),
    hours: Number(db.hours),
    hourlyRate: Number(db.hourly_rate),
    additionalCost: Number(db.additional_cost),
    total: Number(db.total),
  };
}

export const getInvoicesByUser = async (userId: number): Promise<HubUserInvoice[]> => {
  try {
    const res = await pool.query<HubInvoiceDB>(
      'SELECT * FROM hub_invoices WHERE user_id = $1 ORDER BY month DESC',
      [userId],
    );
    return res.rows.map(transform);
  } catch (error) {
    handleRepositoryError('getInvoicesByUser', error);
  }
};

export const createInvoice = async (userId: number, data: any): Promise<HubUserInvoice> => {
  try {
    const res = await pool.query<HubInvoiceDB>(
      `INSERT INTO hub_invoices (user_id, project_id, month, generated_at, hours, hourly_rate, additional_cost, total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        userId,
        data.projectId,
        data.month,
        data.generatedAt ?? new Date().toISOString(),
        data.hours,
        data.hourlyRate,
        data.additionalCost ?? 0,
        data.total,
      ],
    );
    return transform(res.rows[0]);
  } catch (error) {
    handleRepositoryError('createInvoice', error);
  }
};

export const deleteInvoice = async (id: number): Promise<boolean> => {
  try {
    const res = await pool.query('DELETE FROM hub_invoices WHERE id = $1 RETURNING id', [id]);
    return (res.rowCount ?? 0) > 0;
  } catch (error) {
    handleRepositoryError('deleteInvoice', error);
  }
};
