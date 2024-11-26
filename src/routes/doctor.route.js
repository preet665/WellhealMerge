import express from 'express';
import {
    login,
    getLoggedInUser,
    addPersonalDetail,
    addBankingDetail,
    addAvailabilityDetail,
    aboutDoctorDetail,
    getFilterSlots,
    getDoctorSlots,
    deleteSlots,
    getAllSlots,
    addMode,
    getMode,
    updateMode,
    updateModeStatus,
    getPatients,
    getAppointments,
    addPrescription,
    getSingleAppointment,
    appointmentCount,
    getMonthYearWiseAppointment,
    logout,
    addOtherDoctor,
    getTransactionHistory,
} from '../controllers/doctor.controller.js';

// Import WellHeal's middlewares
import { verifyMiddleware, authMiddleware,doctorAuthMiddleware } from "../shared/middleweres/auth.middlewere.js";

// Import multer upload middleware
import handleUpload from "../shared/middleweres/multerUpload.js";

const router = express.Router();

// Apply WellHeal's verifyMiddleware globally to all routes
router.use(verifyMiddleware);

// Doctor routes
router.post("/login", login);
router.get("/getLoggedInUser", doctorAuthMiddleware, getLoggedInUser);
router.post("/addPersonalDetail", doctorAuthMiddleware, handleUpload, addPersonalDetail);
router.post("/addOtherDoctor", doctorAuthMiddleware, handleUpload, addOtherDoctor);
router.post("/addBankingDetail", doctorAuthMiddleware, addBankingDetail);
router.post("/getTransactionHistory", doctorAuthMiddleware, getTransactionHistory);
router.post("/addAvailabilityDetail", doctorAuthMiddleware, addAvailabilityDetail);
router.get("/aboutDoctorDetail", doctorAuthMiddleware, aboutDoctorDetail);
router.post("/getFilterSlots", doctorAuthMiddleware, getFilterSlots);
router.get("/getDoctorSlots", doctorAuthMiddleware, getDoctorSlots);
router.put("/deleteSlot/:id", doctorAuthMiddleware, deleteSlots);
router.get("/getAllSlots", doctorAuthMiddleware, getAllSlots);
router.get("/getPatients", doctorAuthMiddleware, getPatients);

// Appointments
router.get("/getAppointments", doctorAuthMiddleware, getAppointments);
router.get("/getSingleAppointment/:id", doctorAuthMiddleware, getSingleAppointment);
router.get("/appointmentCount", doctorAuthMiddleware, appointmentCount);
router.get("/getMonthYearWiseAppointment", doctorAuthMiddleware, getMonthYearWiseAppointment);

// Prescription
router.post("/addPrescription", doctorAuthMiddleware, addPrescription);

// Mode
router.post("/addMode", doctorAuthMiddleware, addMode);
router.get("/getMode", doctorAuthMiddleware, getMode);
router.put("/updateMode/:id", doctorAuthMiddleware, updateMode);
router.put("/updateModeStatus/:id", doctorAuthMiddleware, updateModeStatus);

// Logout
router.post("/logout", doctorAuthMiddleware, logout);

// Export the router
export default router;
