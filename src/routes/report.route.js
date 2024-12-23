import { Router } from "express";
import { deleteReport, getReport, getReports, newReport, updateReport } from "../controllers/report.controller.js";
import { authMiddleware, doctorAuthMiddleware, verifyMiddleware } from "../shared/middleweres/auth.middlewere.js";
// Import multer upload middleware
import {uploadReportAttachment} from "../shared/middleweres/multerUpload.js";

const routes = new Router();
// Auth Token Gateway
routes.use(verifyMiddleware);
routes.use(doctorAuthMiddleware);

routes.get('/get', getReports);
routes.get('/get/:reportId', getReport);
routes.post('/add', uploadReportAttachment, newReport);
routes.post('/update', uploadReportAttachment, updateReport);
routes.post('/delete', deleteReport);

export default routes;