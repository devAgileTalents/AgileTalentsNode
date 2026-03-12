import { Router, RequestHandler } from 'express';

type PaginationResult<T> = { data: T[]; total: number };

type ListFn<T> = (page: number, limit: number, filters?: any) => Promise<PaginationResult<T>>;
type GetFn<T> = (id: number) => Promise<T | null>;
type CreateFn<T> = (payload: any) => Promise<T>;
type UpdateFn<T> = (id: number, payload: any) => Promise<T | null>;
type DeleteFn = (id: number) => Promise<boolean>;

export type CrudRepo<T> = {
  list: ListFn<T>;
  getById: GetFn<T>;
  create: CreateFn<T>;
  update: UpdateFn<T>;
  remove: DeleteFn;
};

export const validatePagination: RequestHandler = (req, res, next) => {
  const { page, limit } = req.query;

  if (page && (+page < 1 || Number.isNaN(+page)))
    return res.status(400).json({ error: 'Invalid page parameter' });

  if (limit && (+limit < 1 || +limit > 100 || Number.isNaN(+limit)))
    return res.status(400).json({ error: 'Invalid limit parameter (1-100)' });

  next();
};

type CrudRouterOptions = {
  notFoundName?: string;
  parseListQuery?: (req: any) => any;

  // опциональные middlewares (например, auth/validation)
  beforeCreate?: RequestHandler[];
  beforeUpdate?: RequestHandler[];
};

export function createCrudRouter<T>(repo: CrudRepo<T>, options: CrudRouterOptions = {}) {
  const router = Router();
  const notFoundName = options.notFoundName ?? 'Resource';
  const parseListQuery = options.parseListQuery ?? ((req) => ({ search: req.query.search }));

  // LIST
  router.get('/', validatePagination, async (req, res) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;

      const filters = parseListQuery(req);
      const result = await repo.list(page, limit, filters);

      res.json({
        data: result.data,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    } catch (error) {
      console.error('LIST route error:', error);
      res.status(500).json({ error: 'Failed to fetch data' });
    }
  });

  // GET BY ID
  router.get('/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

      const entity = await repo.getById(id);
      if (!entity) return res.status(404).json({ error: `${notFoundName} not found` });

      res.json(entity);
    } catch {
      res.status(500).json({ error: 'Failed to fetch data' });
    }
  });

  // CREATE
  router.post('/', ...(options.beforeCreate ?? []), async (req, res) => {
    try {
      const created = await repo.create(req.body);
      res.status(201).json(created);
    } catch {
      res.status(500).json({ error: 'Failed to create' });
    }
  });

  // UPDATE
  router.put('/:id', ...(options.beforeUpdate ?? []), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

      const updated = await repo.update(id, req.body);
      if (!updated) return res.status(404).json({ error: `${notFoundName} not found` });

      res.json(updated);
    } catch {
      res.status(500).json({ error: 'Failed to update' });
    }
  });

  // DELETE
  router.delete('/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

      const ok = await repo.remove(id);
      if (!ok) return res.status(404).json({ error: `${notFoundName} not found` });

      res.status(204).send();
    } catch {
      res.status(500).json({ error: 'Failed to delete' });
    }
  });

  return router;
}
