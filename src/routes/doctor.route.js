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
    addDoctor,
    updateDoctor,
    getDoctor,
    getDoctors,
    deleteDoctor,
} from '../controllers/doctor.controller.js';

// Import WellHeal's middlewares
import { verifyMiddleware, authMiddleware,doctorAuthMiddleware, leadDoctorMiddleware } from "../shared/middleweres/auth.middlewere.js";

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


// Other doctor routes
router.post("/add", doctorAuthMiddleware, leadDoctorMiddleware, handleUpload, addDoctor);
router.post("/update", doctorAuthMiddleware, leadDoctorMiddleware, handleUpload, updateDoctor);
router.get("/get", doctorAuthMiddleware, leadDoctorMiddleware, getDoctors);
router.get("/get/:doctorId", doctorAuthMiddleware, leadDoctorMiddleware, getDoctor);
router.post("/delete", doctorAuthMiddleware, leadDoctorMiddleware, deleteDoctor);

// Export the router
export default router;
