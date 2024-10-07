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
    getTransactionHistory,
    getCallReviewsByDoctor,
    getChatList,
    createRoomId
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
router.post("/addBankingDetail", doctorAuthMiddleware, addBankingDetail);
router.post("/addAvailabilityDetail", doctorAuthMiddleware, addAvailabilityDetail);
router.get("/aboutDoctorDetail", doctorAuthMiddleware, aboutDoctorDetail);
router.post("/getFilterSlots", doctorAuthMiddleware, getFilterSlots);
router.get("/getDoctorSlots", doctorAuthMiddleware, getDoctorSlots);
router.put("/deleteSlot/:id", doctorAuthMiddleware, deleteSlots);
router.get("/getAllSlots", doctorAuthMiddleware, getAllSlots);
router.get("/getPatients", doctorAuthMiddleware, getPatients);
router.post("/getTransactionHistory",doctorAuthMiddleware, getTransactionHistory);
// Appointments
router.get("/getAppointments", doctorAuthMiddleware, getAppointments);
router.get("/getSingleAppointment/:id", doctorAuthMiddleware, getSingleAppointment);
router.get("/appointmentCount", doctorAuthMiddleware, appointmentCount);
router.get("/getMonthYearWiseAppointment", doctorAuthMiddleware, getMonthYearWiseAppointment);
router.post("/getCallReviewsByDoctor",doctorAuthMiddleware, getCallReviewsByDoctor);
// Prescription
router.post("/addPrescription", doctorAuthMiddleware, addPrescription);
router.get("/getChatList", doctorAuthMiddleware, getChatList);
// Mode
router.post("/addMode", doctorAuthMiddleware, addMode);
router.get("/getMode", doctorAuthMiddleware, getMode);
router.put("/updateMode/:id", doctorAuthMiddleware, updateMode);
router.put("/updateModeStatus/:id", doctorAuthMiddleware, updateModeStatus);
router.post("/createRoomId", doctorAuthMiddleware, createRoomId);
// Logout
router.post("/logout", doctorAuthMiddleware, logout);

// Export the router
export default router;
