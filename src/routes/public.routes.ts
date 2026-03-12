import { Router } from 'express';

import {
  getFreelancers,
  getFreelancerById,
  createFreelancer,
  updateFreelancer,
  deleteFreelancer,
} from '../db/repositories/freelancers';

import {
  getReviews,
  getReviewById,
  createReview,
  updateReview,
  deleteReview,
} from '../db/repositories/reviews';

import {
  getBlogArticles,
  getBlogArticleById,
  createBlogArticle,
  updateBlogArticle,
  deleteBlogArticle,
} from '../db/repositories/blog-articles';
import { createCrudRouter } from '../api/crudRouter';
import authAdminRoutes from './auth.admin.routes';
import authHubRoutes from './auth.hub.routes';

const router = Router();
router.use('/admin/auth', authAdminRoutes);
router.use('/hub/auth', authHubRoutes);

router.use(
  '/freelancers',
  createCrudRouter(
    {
      list: (page, limit, filters) => getFreelancers(page, limit, filters),
      getById: getFreelancerById,
      create: createFreelancer,
      update: updateFreelancer,
      remove: deleteFreelancer,
    },
    {
      notFoundName: 'Freelancer',
      parseListQuery: (req) => ({
        search: typeof req.query.search === 'string' ? req.query.search : undefined,

        name: typeof req.query.name === 'string' ? req.query.name : undefined,
        profession: typeof req.query.profession === 'string' ? req.query.profession : undefined,
        tech: typeof req.query.tech === 'string' ? req.query.tech : undefined,

        minRate: req.query.minRate ? Number(req.query.minRate) : undefined,
        maxRate: req.query.maxRate ? Number(req.query.maxRate) : undefined,
        minExp: req.query.minExp ? Number(req.query.minExp) : undefined,
      }),
    },
  ),
);

router.use(
  '/reviews',
  createCrudRouter(
    {
      list: (page, limit, filters) => getReviews(page, limit, filters),
      getById: getReviewById,
      create: createReview,
      update: updateReview,
      remove: deleteReview,
    },
    {
      notFoundName: 'Review',
      parseListQuery: (req) => ({
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        rating: req.query.rating ? Number(req.query.rating) : undefined,
        reviewer: typeof req.query.reviewer === 'string' ? req.query.reviewer : undefined,
        text: typeof req.query.text === 'string' ? req.query.text : undefined,
      }),
    },
  ),
);

router.use(
  '/blog-articles',
  createCrudRouter(
    {
      list: (page, limit, filters) => getBlogArticles(page, limit, filters),
      getById: getBlogArticleById,
      create: createBlogArticle,
      update: updateBlogArticle,
      remove: deleteBlogArticle,
    },
    {
      notFoundName: 'Blog article',
      parseListQuery: (req) => ({
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        title: typeof req.query.title === 'string' ? req.query.title : undefined,
        author: typeof req.query.author === 'string' ? req.query.author : undefined,
        fromDate: typeof req.query.fromDate === 'string' ? req.query.fromDate : undefined,
        toDate: typeof req.query.toDate === 'string' ? req.query.toDate : undefined,
      }),
    },
  ),
);

export default router;
