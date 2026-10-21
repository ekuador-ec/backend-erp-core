import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { createRateLimit } from './middlewares/rateLimit.js';
import { authRouter } from './modules/auth/authRoute.js';
import { userRouter } from './modules/user/userRoute.js';
import { companyRouter } from './modules/company/companyRoute.js';
import { branchRouter } from './modules/branch/branchRoute.js';
import { checkoutRouter } from './modules/checkout/checkoutRoute.js';
import { categoryRouter } from './modules/category/categoryRoute.js';
import { brandRouter } from './modules/brand/brandRoute.js';
import { proveedorRouter } from './modules/proveedor/proveedorRoute.js';
import { medidaRouter } from './modules/medida/medidaRoute.js';
import { productRouter } from './modules/product/productRoute.js';
import { stockRouter } from './modules/stock/stockRoute.js';
import { clientRouter } from './modules/client/clientRoute.js';
import { playmentMethodRouter } from './modules/playmentMethod/playmentMethodRoute.js';
import { proformaRouter } from './modules/proforma/proformaRoute.js';
import { configRouter } from './modules/config/configRoute.js';
import { alertRouter } from './modules/alert/alertRoute.js';
import { permissionRouter } from './modules/permission/permissionRoute.js';
import { logger } from './utils/logger.js';

const app: express.Express = express();
const authRateLimit = createRateLimit({
  maxRequests: 10,
  windowMs: 60_000,
});
const writeRateLimit = createRateLimit({
  maxRequests: 60,
  windowMs: 60_000,
});
const readRateLimit = createRateLimit({
  maxRequests: 120,
  windowMs: 60_000,
});
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isAuthRequest(path: string): boolean {
  return path === '/auth' || path.startsWith('/auth/');
}

app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigin,
  }),
);
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use(
  morgan('combined', {
    stream: {
      write: (message: string): void => {
        logger.info(message.trim());
      },
    },
  }),
);
app.use((req, res, next) => {
  if (isAuthRequest(req.path)) {
    authRateLimit(req, res, next);
    return;
  }

  next();
});
app.use((req, res, next) => {
  if (isAuthRequest(req.path)) {
    next();
    return;
  }

  if (WRITE_METHODS.has(req.method)) {
    writeRateLimit(req, res, next);
    return;
  }

  next();
});
app.use((req, res, next) => {
  if (isAuthRequest(req.path)) {
    next();
    return;
  }

  if (req.method === 'GET') {
    readRateLimit(req, res, next);
    return;
  }

  next();
});

app.get('/', (_req, res) => {
  res.status(200).json({
    name: 'esnt-backend-ferreteria',
    version: '1.0.0',
  });
});

app.use('/auth', authRouter);
app.use('/companies', companyRouter);
app.use('/users', userRouter);
app.use('/branches', branchRouter);
app.use('/checkouts', checkoutRouter);
app.use('/categories', categoryRouter);
app.use('/brands', brandRouter);
app.use('/proveedores', proveedorRouter);
app.use('/medidas', medidaRouter);
app.use('/products', productRouter);
app.use('/stocks', stockRouter);
app.use('/clients', clientRouter);
app.use('/playment-methods', playmentMethodRouter);
app.use('/proformas', proformaRouter);
app.use('/configs', configRouter);
app.use('/alerts', alertRouter);
app.use('/permissions', permissionRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export { app };
