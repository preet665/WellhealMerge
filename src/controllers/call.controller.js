// src/controllers/call.controller.js

import mongoose from "mongoose";
import Call from "../models/call.model.js";

/**
 * Get call history for a specific user (doctor or user).
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
export const getCallHistory = async (req, res) => {
    try {
        const { userId, role } = req.query;

        if (!userId || !role) {
            return res.status(400).json({
                success: false,
                message: "userId and role are required parameters.",
            });
        }

        if (!["Doctor", "User"].includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Invalid role. Must be either 'Doctor' or 'User'.",
            });
        }

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid userId format.",
            });
        }

        let filter = {};
        if (role === "Doctor") {
            filter.doctorId = userId;
        } else if (role === "User") {
            filter.userId = userId;
        }

        const calls = await Call.find(filter)
            .populate('doctorId', 'name profile_image') // Populate doctor details
            .populate('userId', 'name profile_image') // Populate user details
            .populate('appointmentId', 'appointmentDate') // Populate appointment details
            .populate('timeSlot', 'startTime endTime') // Populate time slot details
            .sort({ startTime: -1 }) // Sort by most recent
            .lean();

        return res.status(200).json({
            success: true,
            data: calls,
            message: "Call history retrieved successfully.",
        });

    } catch (error) {
        console.error("Error fetching call history:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
