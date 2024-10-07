import mongoose from 'mongoose'; // MongoDB ODM for database interaction
import Call from '../models/call.model.js'; // Import Call model
import User from '../models/user.model.js'; // Import User model (optional if you use populate)
import Doctor from '../models/doctor.model.js'; // Import Doctor model (optional if you use populate)
import logger from '../config/logger.js'; // Import logger (adjust according to your setup)

export const getCallHistory = async (req, res) => {
  try {
    const { doctorId } = req.body;

    // Validate doctorId
    if (!doctorId) {
      return res.status(400).json({
        success: false,
        message: "doctorId is a required parameter.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid doctorId format.",
      });
    }

    // Find calls for the specified doctorId
    const calls = await Call.find({ doctorId })
      .sort({ startTime: -1 }) // Sort by the most recent call
      .lean();

    if (!calls || calls.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No call history found for the given doctorId.",
      });
    }

    // Prepare call history data
    const callHistory = await Promise.all(calls.map(async (call) => {
      const user = await User.findById(call.userId);
      return {
        callId: call._id,
        userId: call.userId,
        appointmentId: call.appointmentId,
        date: call.date,
        status: call.status,
        startTime: call.startTime,
        endTime: call.endTime || "N/A",
        duration: call.duration || "N/A",
        callType: call.callType,
        paymentStatus: call.paymentStatus,
        user: {
          name: user ? user.name : "N/A",
          profileImage: user ? user.profile_image : "N/A",
        },
      };
    }));

    return res.status(200).json({
      success: true,
      data: callHistory,
      message: "Call history retrieved successfully.",
    });
  } catch (error) {
    console.error("Error fetching call history:", error);
    logger.log('error', `Error fetching call history: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};
