import { Router } from 'express';
import { requireHubAuth } from './auth.hub.routes';

import {
  getHubUsers,
  getAllHubUsers,
  getHubUserById,
  createHubUser,
  updateHubUser,
  deleteHubUser,
} from '../db/repositories/hub-users';

import {
  getHubProjects,
  getAllHubProjects,
  getHubProjectById,
  createHubProject,
  updateHubProject,
  deleteHubProject,
} from '../db/repositories/hub-projects';

import {
  getLoggedHoursByUser,
  createLoggedHour,
  updateLoggedHour,
  deleteLoggedHour,
} from '../db/repositories/hub-logged-hours';

import {
  getInvoicesByUser,
  createInvoice,
  deleteInvoice,
} from '../db/repositories/hub-invoices';

const router = Router();

// All hub/data routes require authentication
router.use(requireHubAuth);

/* ═══════════════════════════════════════════
   USERS
   ═══════════════════════════════════════════ */

// GET /hub/data/users — paginated list
router.get('/users', async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 100;
    const filters = {
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      role: typeof req.query.role === 'string' ? req.query.role : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    };

    const result = await getHubUsers(page, limit, filters);
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
    console.error('GET /hub/data/users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /hub/data/users/all — all users without pagination (for dropdowns, access lists etc.)
router.get('/users/all', async (_req, res) => {
  try {
    const users = await getAllHubUsers();
    res.json(users);
  } catch (error) {
    console.error('GET /hub/data/users/all error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /hub/data/users/:id
router.get('/users/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const user = await getHubUserById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json(user);
  } catch (error) {
    console.error('GET /hub/data/users/:id error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /hub/data/users
router.post('/users', async (req, res) => {
  try {
    const user = await createHubUser(req.body);
    res.status(201).json(user);
  } catch (error) {
    console.error('POST /hub/data/users error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /hub/data/users/:id
router.put('/users/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const user = await updateHubUser(id, req.body);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json(user);
  } catch (error) {
    console.error('PUT /hub/data/users/:id error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /hub/data/users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const ok = await deleteHubUser(id);
    if (!ok) return res.status(404).json({ error: 'User not found' });

    res.status(204).send();
  } catch (error) {
    console.error('DELETE /hub/data/users/:id error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

/* ═══════════════════════════════════════════
   PROJECTS
   ═══════════════════════════════════════════ */

// GET /hub/data/projects — paginated
router.get('/projects', async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 100;
    const filters = {
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      clientId: req.query.clientId ? Number(req.query.clientId) : undefined,
    };

    const result = await getHubProjects(page, limit, filters);
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
    console.error('GET /hub/data/projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// GET /hub/data/projects/all — all projects (no pagination)
router.get('/projects/all', async (_req, res) => {
  try {
    const projects = await getAllHubProjects();
    res.json(projects);
  } catch (error) {
    console.error('GET /hub/data/projects/all error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// GET /hub/data/projects/:id
router.get('/projects/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const project = await getHubProjectById(id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    res.json(project);
  } catch (error) {
    console.error('GET /hub/data/projects/:id error:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// POST /hub/data/projects
router.post('/projects', async (req, res) => {
  try {
    const project = await createHubProject(req.body);
    res.status(201).json(project);
  } catch (error) {
    console.error('POST /hub/data/projects error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// PUT /hub/data/projects/:id
router.put('/projects/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const project = await updateHubProject(id, req.body);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    res.json(project);
  } catch (error) {
    console.error('PUT /hub/data/projects/:id error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// DELETE /hub/data/projects/:id
router.delete('/projects/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const ok = await deleteHubProject(id);
    if (!ok) return res.status(404).json({ error: 'Project not found' });

    res.status(204).send();
  } catch (error) {
    console.error('DELETE /hub/data/projects/:id error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

/* ═══════════════════════════════════════════
   LOGGED HOURS
   ═══════════════════════════════════════════ */

// GET /hub/data/logged-hours/:userId
router.get('/logged-hours/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (Number.isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

    const hours = await getLoggedHoursByUser(userId);
    res.json(hours);
  } catch (error) {
    console.error('GET /hub/data/logged-hours/:userId error:', error);
    res.status(500).json({ error: 'Failed to fetch logged hours' });
  }
});

// POST /hub/data/logged-hours/:userId
router.post('/logged-hours/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (Number.isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

    const hour = await createLoggedHour(userId, req.body);
    res.status(201).json(hour);
  } catch (error) {
    console.error('POST /hub/data/logged-hours error:', error);
    res.status(500).json({ error: 'Failed to create logged hour' });
  }
});

// PUT /hub/data/logged-hours/:id
router.put('/logged-hours/entry/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const hour = await updateLoggedHour(id, req.body);
    if (!hour) return res.status(404).json({ error: 'Logged hour not found' });

    res.json(hour);
  } catch (error) {
    console.error('PUT /hub/data/logged-hours/:id error:', error);
    res.status(500).json({ error: 'Failed to update logged hour' });
  }
});

// DELETE /hub/data/logged-hours/entry/:id
router.delete('/logged-hours/entry/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const ok = await deleteLoggedHour(id);
    if (!ok) return res.status(404).json({ error: 'Logged hour not found' });

    res.status(204).send();
  } catch (error) {
    console.error('DELETE /hub/data/logged-hours/:id error:', error);
    res.status(500).json({ error: 'Failed to delete logged hour' });
  }
});

/* ═══════════════════════════════════════════
   INVOICES
   ═══════════════════════════════════════════ */

// GET /hub/data/invoices/:userId
router.get('/invoices/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (Number.isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

    const invoices = await getInvoicesByUser(userId);
    res.json(invoices);
  } catch (error) {
    console.error('GET /hub/data/invoices/:userId error:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// POST /hub/data/invoices/:userId
router.post('/invoices/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (Number.isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

    const invoice = await createInvoice(userId, req.body);
    res.status(201).json(invoice);
  } catch (error) {
    console.error('POST /hub/data/invoices error:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// DELETE /hub/data/invoices/:id
router.delete('/invoices/entry/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const ok = await deleteInvoice(id);
    if (!ok) return res.status(404).json({ error: 'Invoice not found' });

    res.status(204).send();
  } catch (error) {
    console.error('DELETE /hub/data/invoices/:id error:', error);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

export default router;
