// controllers/user.controller.js
import mongoose from "mongoose";
import Stripe from "stripe";
import Path from "path";
import AgoraToken from 'agora-access-token';
const { RtcTokenBuilder, RtcRole } = AgoraToken;
import messages from "../shared/constant/messages.const.js";
import { logger, level } from "../config/logger.js";
import Favorites from "../models/favorite.model.js";
import Therapy from "../models/therapy.model.js";
import Slug from "../models/slugs.model.js";
import Resource from "../models/resource.model.js";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import ChatList from "../models/chatlist.model.js";
import Appointment from "../models/appointment.model.js";
import DoctorAvailability from "../models/doctor_availability.model.js";
import Doctor from "../models/doctor.model.js";
import CallReviewRating from '../models/call_review_rating.model.js';
import Call from '../models/call.model.js';
import Mode from '../models/mode.model.js'
import {
  internalServerError,
  beautify,
  okResponse,
  generateRandomString,
  badRequestError,
  toObjectId,
  paramMissingError,
} from "../shared/utils/utility.js";
import {
  AUDIO_VIDEO_EXTENSIONS,
  DOC_EXTENSIONS,
  FAVORITE_CONTENT_TYPE,
  IMAGE_EXTENSIONS,
  SLUG_TYPE,
} from "../shared/constant/types.const.js";
import {
  getSignedUrl,
  uploadFileToS3,
} from "../shared/services/file-upload/aws-s3.service.js";
import { returnOnNotExist } from "../shared/services/database/query.service.js";
import { getProgressOfTherapies } from "../shared/pipeline/therapy.pipeline.js";
import UserProgress from "../models/user_progress.model.js";
import UserToken from "../models/user_token.model.js";
import { sendPushNotification } from "../shared/services/firebase/send_notification.service.js";
import ReviewRating from "../models/review_rating.model.js";
import Notification from "../models/notification.model.js";
import scheduleNotification from "../models/schedule_notification.model.js";
import UserDevices from "../models/user_devices_model.js";

// Import Agora SDK for token generation
//import { RtcTokenBuilder, RtcRole } from 'agora-access-token';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
export async function getFilterSlots(req, res) {                                                                                                                                                          
    try {                                                                                                                                                                                                 
        const { doctorId, date } = req.body;                                                                                                                                                              
        const role = req.userdata.role;                                                                                                                                                                   
        const userId = req.userdata._id;

        console.log(`Starting to fetch filter-wise slots...`);
        console.log(`User ID: ${userId}, User Role: ${role}, Doctor ID: ${doctorId}, Date: ${date}`);

        // Validate inputs
        if (!doctorId || !date) {
            return res.status(400).send({ message: "Doctor ID and Date are required!", success: false });
        }

        // Validate date format (YYYY-MM-DD)
        const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
        if (!isValidDate) {
            return res.status(400).send({ message: "Date must be in YYYY-MM-DD format", success: false });
        }

        // Find the user (doctor or user)
        const findUser = role === 'doctor' ? await Doctor.findById(doctorId).lean() : await User.findById(userId).lean();
        if (!findUser) {
            return res.status(404).send({ message: "User not found!", success: false });
        }

        // Since dates are stored as strings, no need to create Date objects for querying
        const requestedDate = date.trim(); // Additional trimming if necessary

        console.log(`Searching for DoctorAvailability on ${requestedDate}`);

        // Fetch DoctorAvailability from DoctorAvailability collection
        let doctorAvailability = await DoctorAvailability.findOne({
            doctorId: doctorId,
            date: requestedDate, // Match the exact string
        })
            .populate({
                path: 'mode', // Corrected populate path
                select: 'name price isActive',
            })
            .lean();

        if (!doctorAvailability) {
            return res.status(404).send({
                message: "No availability found for this date",
                success: false,
            });
        }

        console.log("DoctorAvailability found:", doctorAvailability);

        // Fetch appointments
        const appointments = await Appointment.find({
            doctorId: doctorId,
            date: requestedDate, // Assuming 'date' in appointments is also a string
        }).lean();

        console.log(`Found ${appointments.length} appointments`);

        // Create a map for quick lookup of booked slots
        const bookedSlotsMap = {};
        appointments.forEach(appointment => {
            const slotTime = appointment.timeSlot?.time || appointment.timeSlot;
            if (slotTime) {
                bookedSlotsMap[slotTime] = {
                    appointmentId: appointment._id,
                    userId: appointment.userId
                };
            }
        });

        // Update slots with booking information
        const updatedSlots = doctorAvailability.slot.map(slot => {
            if (bookedSlotsMap[slot.time]) {
                return {
                    ...slot,
                    isBooked: true,
                    appointmentId: bookedSlotsMap[slot.time].appointmentId,
                    userId: bookedSlotsMap[slot.time].userId
                };
            }
            return {
                ...slot,
                isBooked: false
            };
        });

        // Add the updated slots back to doctorAvailability
        doctorAvailability.slot = updatedSlots;

        // **Enhanced Logging Before Mapping `mode`**
        console.log("Before mapping, doctorAvailability.mode:", doctorAvailability.mode);

        // **Add Check for `mode`**
        if (!doctorAvailability.mode || !Array.isArray(doctorAvailability.mode)) {
            console.error('Error: doctorAvailability.mode is undefined or not an array:', doctorAvailability.mode);
            return res.status(500).send({
                message: "Doctor modes are not properly defined.",
                success: false,
            });
        }

        // Normalize mode names and add descriptions
        const modeDescriptions = {
            "voicecall": "Can make voice call with doctor",
            "videocall": "Can make video call with doctor",
            "chat": "Can make messaging with doctor",
            "offline": "Can make meeting at doctor's clinic"
        };

        doctorAvailability.mode = doctorAvailability.mode.map(mode => {
            if (!mode || !mode.name) {
                console.warn('Warning: Invalid mode encountered:', mode);
                return {
                    _id: mode?._id || null,
                    name: mode?.name || 'Unknown',
                    price: mode?.price || 0,
                    description: "No description available"
                };
            }
            const normalizedModeName = mode.name.toLowerCase().replace(/\s+/g, '');
            return {
                _id: mode._id,
                name: mode.name,
                price: mode.price,
                description: modeDescriptions[normalizedModeName] || "No description available"
            };
        });

        // **Optional: Remove modeId if it exists**
        // delete doctorAvailability.modeId; // Commented out since 'modeId' no longer exists

        // Generate upcomingDates (e.g., next 20 days excluding today)
        const upcomingDates = [];
        for (let i = 1; i <= 20; i++) {
            const upcomingDate = new Date();
            upcomingDate.setDate(upcomingDate.getDate() + i);
            const year = upcomingDate.getFullYear();
            const month = String(upcomingDate.getMonth() + 1).padStart(2, '0'); // Months are zero-based
            const day = String(upcomingDate.getDate()).padStart(2, '0');
            upcomingDates.push(`${year}-${month}-${day}`); // Format: YYYY-MM-DD                                                                                                          
        }                                                                                                                                                                                                

        console.log(`Final DoctorAvailability data: ${JSON.stringify(doctorAvailability)}`);

        return res.status(200).send({                                                                                                                                                                    
            success: true,                                                                                                                                                                               
            data: doctorAvailability,
            upcomingDates: upcomingDates,
            message: "Slots fetched successfully!",
        });
    } catch (error) {
        console.error(`Error fetching filter-wise slots: ${error.message}`);
        console.error(error.stack);
        return res.status(500).send({
            success: false,
            error: error.message,
            message: "Something went wrong!",
        });
    }
}



export const createCallReview = async (req, res) => {
    try {
        const { callId, doctorId, rating, review } = req.body;
        const userId = req.userdata._id;

        // Validate input
        if (!callId || !doctorId || !rating) {
            return res.status(400).json({
                success: false,
                message: "callId, doctorId, and rating are required.",
            });
        }

        // Optional: Validate that the callId and doctorId are valid and belong to the user
        const call = await Call.findById(callId).lean();
        if (!call) {
            return res.status(404).json({
                success: false,
                message: "Call not found.",
            });
        }

        // Ensure that the call belongs to the user
        if (call.userId.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to review this call.",
            });
        }

        // Ensure that the doctorId matches the call's doctorId
        if (call.doctorId.toString() !== doctorId) {
            return res.status(400).json({
                success: false,
                message: "Doctor does not match the call's doctor.",
            });
        }

        // Check if the user has already reviewed this call
        const existingReview = await CallReviewRating.findOne({ callId, userId });
        if (existingReview) {
            return res.status(400).json({
                success: false,
                message: "You have already reviewed this call.",
            });
        }

        // Create the call review
        const newCallReview = new CallReviewRating({
            doctorId,
            callId,
            userId,
            rating,
            review,
        });

        await newCallReview.save();

        return res.status(201).json({
            success: true,
            data: newCallReview,
            message: "Call review created successfully!",
        });
    } catch (error) {
        console.error("Error creating call review:", error);
        return res.status(500).json({ code: 500, message: error.message });
    }
};
// Book Appointment
export const bookAppointment = async (req, res) => { 
    try {
        const {
            doctorId,
            date,     
            timeSlot,
            modeId,
            price,
            name,
            ageRange,
            contactNumber,
            gender,
            problem,
        } = req.body;

        // Ensure userdata is defined before proceeding
        if (!req.userdata || !req.userdata._id) {
            return res.status(400).json({
                success: false,
                message: "User data is missing from request",
            });
        }

        const userId = req.userdata._id;

        const checkExitUser = await User.findById(userId).lean();
        if (!checkExitUser) {
            return res.status(400).json({
                success: false,
                message: "User not found, Please try again!",
            });
        }

        // Query doctor availability using doctorId and date
        const doctorAvailability = await DoctorAvailability.findOne({
            doctorId: doctorId,
            date: date
        }).lean();

        // Check if doctor availability is found
        if (!doctorAvailability) {
            return res.status(400).json({
                success: false,
                message: "Doctor availability not found for the selected date."
            });
        }

        // Fetch mode details from the Mode collection
        const modeDetails = await Mode.findById(modeId).lean();
        if (!modeDetails) {
            return res.status(400).json({
                success: false,
                message: "Selected mode not available. Please select a valid mode.",
            });
        }

        // Fetch time slot details from the array
        const selectedSlot = doctorAvailability.slot.find(slot => slot._id.equals(timeSlot));
        if (!selectedSlot || selectedSlot.isBooked) {
            return res.status(400).json({
                success: false,
                message: "Selected time slot is not available or already booked. Please select a valid time slot.",
            });
        }

        // Save the appointment
        const saveAppointment = await new Appointment({
            doctorId,
            date, 
            timeSlot,
            modeId,
            price,
            name,
            ageRange,
            contactNumber,
            gender,
            problem,
            userId: userId,
            paymentStatus: "Pending",
            status: "Upcoming",
        }).save();

        // Mark the time slot as booked
        await DoctorAvailability.updateOne(
            { "slot._id": timeSlot },
            { $set: { "slot.$.isBooked": true } }
        );

        const doctor = await Doctor.findById(doctorId).lean();

        const response = {
            success: true,
            data: {
                appointment: {
                    doctorId: doctor._id,
                    userId: saveAppointment.userId,
                    date: saveAppointment.date,
                    mode: {
                        _id: modeDetails._id,
                        name: modeDetails.name,
                        description: modeDetails.isActive ? "Active Mode" : "Inactive Mode",
                    },
                    timeSlot: {
                        _id: selectedSlot._id,
                        time: selectedSlot.time,
                        isBooked: selectedSlot.isBooked
                    },
                    price: saveAppointment.price,
                    name: saveAppointment.name,
                    ageRange: saveAppointment.ageRange,
                    contactNumber: saveAppointment.contactNumber,
                    gender: saveAppointment.gender,
                    problem: saveAppointment.problem,
                    paymentStatus: saveAppointment.paymentStatus,
                    status: saveAppointment.status,
                    _id: saveAppointment._id,
                    createdAt: saveAppointment.createdAt,
                    updatedAt: saveAppointment.updatedAt
                },
                doctor: {
                    _id: doctor._id,
                    email: doctor.email,
                    contactNumber: doctor.contactNumber,
                    firstName: doctor.firstName,
                    lastName: doctor.lastName,
                    about: doctor.about,
                    destination: doctor.destination,
                    experience: doctor.experience,
                    profileImage: doctor.profileImage,
                    rating: doctor.rating,
                    review: doctor.review,
                    totalPatients: doctor.totalPatients
                }
            },
            message: "Appointment booked successfully!"
        };

        return res.status(200).json(response);
    } catch (error) {
        console.error("bookAppointment Error: ", error); 
        return res.status(500).json({ code: 500, message: error.message });
    }
};




export const filterAppointment = async (req, res) => {
   try {
        const { status } = req.body;
        const userId = req.userdata._id;

        // Step 1: Verify that the user exists
        const user = await User.findById(userId).lean();
        if (!user) {
            return res.status(400).json({
                success: false,
                message: "User not found, Please try again!",
            });
        }

        // Step 2: Fetch appointments and populate modeId
        let appointments = await Appointment.find({ userId, status })
            .populate('modeId', 'name price isActive') // Populate modeId with selected fields
            .lean();

       
        // Step 4: Manually populate timeSlot data and handle mode consistency
        for (let appointment of appointments) {
	    if (appointment.date) {
                const dateObj = new Date(appointment.date);
                const day = String(dateObj.getDate()).padStart(2, '0');
                const month = String(dateObj.getMonth() + 1).padStart(2, '0'); // Months are zero-based
                const year = dateObj.getFullYear();
                appointment.date = `${day}/${month}/${year}`;
            }
            if (appointment.timeSlot) {
                // Fetch DoctorAvailability for the given timeSlot
                const availability = await DoctorAvailability.findOne({
                    "slot._id": appointment.timeSlot
                }, { "slot.$": 1, "mode": 1 }).lean();

                if (availability && availability.slot.length > 0) {
                    // Update the timeSlot with its details
                    appointment.timeSlot = {
                        _id: availability.slot[0]._id,
                        time: availability.slot[0].time
                    };

                    // Check if modeId exists and is active in DoctorAvailability
                    if (appointment.modeId) {
                        const modeExists = availability.mode.some(
                            m => m.toString() === appointment.modeId._id.toString()
                        );

                        if (modeExists) {
                            // Mode is valid and active
                            // Optionally, you can assign additional mode details if needed
                            appointment.mode = {
                                _id: appointment.modeId._id,
                                name: appointment.modeId.name,
                                price: appointment.modeId.price,
                                isActive: appointment.modeId.isActive
                            };
                        } else {
                            // ModeId does not exist in DoctorAvailability modes
                            appointment.mode = null;
                        }
                    } else {
                        // No modeId present in the appointment
                        appointment.mode = null;
                    }
                } else {
                    // No matching DoctorAvailability found
                    appointment.timeSlot = null;
                    appointment.mode = null;
                }
            } else {
                // No timeSlot present in the appointment
                appointment.timeSlot = null;
                appointment.mode = null;
            }
        }

        // Step 5: Return the response with populated data
        return res.status(200).json({
            success: true,
            data: appointments,
            message: "Appointment data fetched successfully!",
        });
    } catch (error) {
        console.error("Error fetching appointments:", error);
        return res.status(500).json({ code: 500, message: error.message });
    }
};
// Cancel Appointment
export const cancelAppointment = async (req, res) => {
    try {
        const { appointmentId, reason, isOther } = req.body;
        const userId = req.userdata._id;

        const checkExitUser = await User.findById(userId).lean();

        if (!checkExitUser) {
            return res.status(400).json({
                success: false,
                message: "User not found, Please try again!",
            });
        }

        const findAppointment = await Appointment.findById(appointmentId).lean();

        if (!findAppointment) {
            return res.status(400).json({
                success: false,
                message: "Appointment not found, Please try again!",
            });
        }

        // Update slot
        await DoctorAvailability.findOneAndUpdate(
            {
                date: findAppointment.date,
                "slot._id": mongoose.Types.ObjectId(findAppointment.timeSlot),
            },
            {
                $set: { "slot.$.isBooked": false },
            },
            { new: true }
        );

        // Update appointment status
        await Appointment.findByIdAndUpdate(
            appointmentId,
            { status: "Cancel", isOther, reason },
            { new: true }
        ).lean();

        return res.status(200).json({
            success: true,
            message: "Appointment cancelled successfully!",
        });
    } catch (error) {
        logger.log(level.error, `cancelAppointment Error: ${beautify(error.message)}`);
        return res.status(500).json({ code: 500, message: error.message });
    }
};

// Reschedule Appointment
export const rescheduleAppointment = async (req, res) => {
    try {
        const { appointmentId, reason, date, timeSlot } = req.body;
        const userId = req.userdata._id;

        const checkExitUser = await User.findById(userId).lean();

        if (!checkExitUser) {
            return res.status(400).json({
                success: false,
                message: "User not found, Please try again!",
            });
        }

        const findAppointment = await Appointment.findById(appointmentId).lean();

        if (!findAppointment) {
            return res.status(400).json({
                success: false,
                message: "Appointment not found, Please try again!",
            });
        }

        const checkExistDate = await DoctorAvailability.findOne({ date }).lean();

        if (!checkExistDate || !checkExistDate.slot?.length) {
            return res.status(400).json({
                success: false,
                message: "No slots added for this date!",
            });
        }

        let checkMode = checkExistDate.mode.some(
            (i) => i.toString() === findAppointment.modeId.toString()
        );
        if (!checkMode) {
            return res.status(400).json({
                success: false,
                message: "Your selected mode does not exist on this date!",
            });
        }

        await Appointment.findByIdAndUpdate(
            appointmentId,
            {
                date,
                timeSlot,
                rescheduleReason: reason,
            },
            { new: true }
        ).lean();

        await DoctorAvailability.findOneAndUpdate(
            { "slot._id": timeSlot },
            { $set: { "slot.$.isBooked": true } },
            { new: true }
        ).lean();

        await DoctorAvailability.findOneAndUpdate(
            { "slot._id": findAppointment.timeSlot },
            { $set: { "slot.$.isBooked": false } },
            { new: true }
        ).lean();

        return res.status(200).json({
            success: true,
            message: "Appointment rescheduled successfully!",
        });
    } catch (error) {
        logger.log(level.error, `rescheduleAppointment Error: ${beautify(error.message)}`);
        return res.status(500).json({ code: 500, message: error.message });
    }
};

// Update User Status
export const userUpdateStatus = async (userId, role) => {
    try {
        if (!userId || !role) {
            return {
                success: false,
                message: "userId and role are required!",
            };
        }

        let user;
        if (role === "user") {
            user = await User.findByIdAndUpdate(
                userId,
                { isOnline: true },
                { new: true }
            );
        } else if (role === "doctor") {
            user = await Doctor.findByIdAndUpdate(
                userId,
                { isOnline: true },
                { new: true }
            );
        } else {
            return {
                success: false,
                message: "Invalid role provided!",
            };
        }

        if (!user) {
            return {
                success: false,
                message: "User not found!",
            };
        }

        return {
            success: true,
            data: user,
            message: "User status updated successfully!",
        };
    } catch (error) {
        logger.log(level.error, `userUpdateStatus Error: ${beautify(error.message)}`);
        return { code: 500, success: false, message: error.message };
    }
};

// Send Message
export const sendMessage = async (data) => {
    try {
        const {
            senderId,
            receiverId,
            roomId,
            message,
            documents,
            senderRole,
            receiverRole,
            isRead,
        } = data;

        const saveMessage = await new Message({
            senderId,
            receiverId,
            roomId,
            message,
            documents,
            senderRole,
            receiverRole,
            isRead,
            date: new Date().toLocaleString(),
        }).save();

        // For sender
        const findSenderId = await ChatList.findOne({ userId: senderId }).lean();

        if (!findSenderId) {
            await new ChatList({
                userId: senderId,
                senderRole: senderRole,
                list: [
                    {
                        userId: receiverId,
                        receiverRole,
                        roomId,
                        lastMessage: saveMessage._id,
                    },
                ],
            }).save();
        } else {
            const findChatInList = await ChatList.findOne({
                userId: senderId,
                "list.roomId": roomId,
            });

            if (!findChatInList) {
                await ChatList.findOneAndUpdate(
                    { userId: senderId },
                    {
                        $push: {
                            list: {
                                userId: receiverId,
                                receiverRole,
                                roomId,
                                lastMessage: saveMessage._id,
                            },
                        },
                    },
                    {
                        new: true,
                    }
                );
            } else {
                await ChatList.findOneAndUpdate(
                    { userId: senderId, "list.roomId": roomId },
                    { $set: { "list.$.lastMessage": saveMessage._id } },
                    { new: true }
                );
            }
        }

        // For receiver
        const findReceiverId = await ChatList.findOne({
            userId: receiverId,
        }).lean();

        if (!findReceiverId) {
            await new ChatList({
                userId: receiverId,
                senderRole: receiverRole,
                list: [
                    {
                        userId: senderId,
                        receiverRole: senderRole,
                        roomId,
                        lastMessage: saveMessage._id,
                    },
                ],
            }).save();
        } else {
            const findChatInList = await ChatList.findOne({
                userId: receiverId,
                "list.roomId": roomId,
            });

            if (!findChatInList) {
                await ChatList.findOneAndUpdate(
                    { userId: receiverId },
                    {
                        $push: {
                            list: {
                                userId: senderId,
                                receiverRole,
                                roomId,
                                lastMessage: saveMessage._id,
                            },
                        },
                    },
                    {
                        new: true,
                    }
                );
            } else {
                await ChatList.findOneAndUpdate(
                    { userId: receiverId, "list.roomId": roomId },
                    { $set: { "list.$.lastMessage": saveMessage._id } },
                    { new: true }
                );
            }
        }

        return {
            success: true,
            message: "Message sent successfully!",
            data: saveMessage,
        };
    } catch (error) {
        logger.log(level.error, `sendMessage Error: ${beautify(error.message)}`);
        return { code: 500, success: false, message: error.message };
    }
};

// Create Room ID
export const createRoomId = async (req, res) => {
    try {
        const { senderId, receiverId } = req.body;

        if (!senderId || !receiverId) {
            return res.status(400).json({
                success: false,
                message: "senderId and receiverId are required!",
            });
        }

        let value = [senderId, receiverId];
        value.sort((a, b) => b.localeCompare(a));
        let roomId = value.join(',');

        return res.status(200).json({
            success: true,
            data: roomId,
            message: "RoomId created successfully!",
        });
    } catch (error) {
        logger.log(level.error, `createRoomId Error: ${beautify(error.message)}`);
        return res.status(500).json({ code: 500, message: error.message });
    }
};

// Get Chat List

export const getChatList = async (req, res) => {
    try {
        console.log('getChatList called');
        logger.log(level.info, 'getChatList called');

        // Check for authenticated user
        if (!req.userdata || !req.userdata._id) {
            console.log('Unauthorized access: Missing userdata');
            logger.log(level.warn, 'Unauthorized access: Missing userdata');
            return res.status(401).json({ success: false, message: 'Unauthorized access' });
        }

        const userId = req.userdata._id;
        console.log(`Fetching chat list for userId: ${userId}`);
        logger.log(level.info, `Fetching chat list for userId: ${userId}`);

        // Validate userId format
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            console.log(`Invalid userId format: ${userId}`);
            logger.log(level.error, `Invalid userId format: ${userId}`);
            return res.status(400).json({ success: false, message: 'Invalid userId format' });
        }

        const userObjectId = new mongoose.Types.ObjectId(userId);

        // Revised Aggregation Pipeline with Correct Enum Values and Removed $isObjectId
        const aggregationPipeline = [
            { $match: { userId: userObjectId } },
            { $unwind: "$list" },
            {
                $addFields: {
                    receiverRoleLower: { $toLower: "$list.receiverRole" }
                }
            },
            {
                $lookup: {
                    from: "users", // Ensure this matches your actual collection name
                    localField: "list.userId",
                    foreignField: "_id",
                    as: "userDetails"
                }
            },
            {
                $lookup: {
                    from: "doctors", // Ensure this matches your actual collection name
                    localField: "list.userId",
                    foreignField: "_id",
                    as: "doctorDetails"
                }
            },
            {
                $lookup: {
                    from: "messages", // Ensure this matches your actual collection name
                    localField: "list.lastMessage",
                    foreignField: "_id",
                    as: "lastMessageDetails"
                }
            },
            {
                $addFields: {
                    hasUserDetails: { $gt: [{ $size: "$userDetails" }, 0] },
                    hasDoctorDetails: { $gt: [{ $size: "$doctorDetails" }, 0] },
                    hasLastMessageDetails: { $gt: [{ $size: "$lastMessageDetails" }, 0] }
                }
            },
            {
                $group: {
                    _id: "$list.roomId",
                    chatListId: { $first: "$_id" },
                    userDetails: {
                        $first: {
                            $cond: [
                                { $eq: ["$receiverRoleLower", "user"] },
                                { $arrayElemAt: ["$userDetails", 0] },
                                { $arrayElemAt: ["$doctorDetails", 0] }
                            ]
                        }
                    },
                    lastMessage: { $first: { $arrayElemAt: ["$lastMessageDetails", 0] } },
                    hasUserDetails: { $first: "$hasUserDetails" },
                    hasDoctorDetails: { $first: "$hasDoctorDetails" },
                    hasLastMessageDetails: { $first: "$hasLastMessageDetails" }
                }
            },
            {
                $project: {
                    _id: "$chatListId",
                    roomId: "$_id",
                    userDetails: {
                        fullName: {
                            $cond: [
                                { $eq: ["$receiverRoleLower", "user"] },
                                "$userDetails.name",
                                {
                                    $concat: [
                                        "$userDetails.firstName",
                                        " ",
                                        "$userDetails.lastName"
                                    ]
                                }
                            ]
                        },
                        profileImage: "$userDetails.profileImage"
                    },
                    lastMessage: {
                        message: "$lastMessage.message",
                        date: "$lastMessage.date"
                    },
                    hasUserDetails: 1,
                    hasDoctorDetails: 1,
                    hasLastMessageDetails: 1
                }
            }
        ];

        console.log('Aggregation Pipeline:', JSON.stringify(aggregationPipeline, null, 2));
        logger.log(level.debug, `Aggregation Pipeline: ${JSON.stringify(aggregationPipeline, null, 2)}`);

        // Execute the aggregation pipeline
        const chatLists = await ChatList.aggregate(aggregationPipeline);

        console.log(`Aggregation result count: ${chatLists.length}`);
        logger.log(level.info, `Aggregation result count: ${chatLists.length}`);

        // Log details about lookup results for debugging
        if (chatLists.length > 0) {
            chatLists.forEach((chat, index) => {
                console.log(`Chat ${index + 1}: ${JSON.stringify(chat, null, 2)}`);
                logger.log(level.debug, `Chat ${index + 1}: ${JSON.stringify(chat, null, 2)}`);
            });
        } else {
            console.log('No chat lists found for the user');
            logger.log(level.info, 'No chat lists found for the user');
        }

        return res.status(200).json({
            success: true,
            data: chatLists,
            message: "Chat list fetched successfully!",
        });

    } catch (error) {
        console.error(`getChatList Error: ${error.message}`);
        logger.log(level.error, `getChatList Error: ${error.message}`);
        return res.status(500).json({ code: 500, message: error.message });
    }
};

// Get Messages Based on Room ID
import mongoose from 'mongoose'; // MongoDB ODM
import Message from '../models/message.model.js'; // Import Message model
import logger from '../config/logger.js'; // Logger for logging errors

export const getMessages = async (req, res) => {
    try {
        const { roomId } = req.body;
        const userId = req.userdata._id; // Assuming userId is stored in req.userdata from authentication middleware

        // Validate roomId
        if (!roomId) {
            return res.status(400).json({
                success: false,
                message: "roomId is required!",
            });
        }

        if (!mongoose.Types.ObjectId.isValid(roomId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid roomId format.",
            });
        }

        // Fetch messages for the room
        const getMessage = await Message.find({ roomId }).lean();

        if (!getMessage || getMessage.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No messages found for the given roomId.",
            });
        }

        // Update messages as read where the receiver is the current user
        await Message.updateMany(
            { receiverId: userId, roomId, isRead: false }, // Only update unread messages
            { $set: { isRead: true } }, // Mark as read
            { new: true } // Return the updated documents
        );

        return res.status(200).json({
            success: true,
            data: getMessage,
            message: "Messages fetched successfully!",
        });

    } catch (error) {
        logger.log('error', `getMessages Error: ${error.message}`);
        return res.status(500).json({
            code: 500,
            message: error.message,
        });
    }
};

// Add or Remove Reaction
export const addReaction = async (data) => {
    try {
        const { messageId, userId, userRole, reactionName, type, reactionId } = data;

        if (!messageId || !userId || !userRole || !type) {
            return {
                success: false,
                message: "messageId, userId, userRole, and type are required!",
            };
        }

        const findMessage = await Message.findById(messageId).lean();

        if (!findMessage) {
            return {
                success: false,
                message: "No message found!",
            };
        }

        if (type === "addReaction") {
            if (!reactionName) {
                return {
                    success: false,
                    message: "reactionName is required for adding a reaction!",
                };
            }

            const addReaction = await Message.findByIdAndUpdate(
                messageId,
                {
                    $push: { reaction: { userId, userRole, reactionName } },
                },
                { new: true }
            );

            return {
                success: true,
                message: "Reaction added successfully!",
                data: addReaction,
            };
        }

        if (type === "removeReaction") {
            if (!reactionId) {
                return {
                    success: false,
                    message: "reactionId is required for removing a reaction!",
                };
            }

            const removeReaction = await Message.findByIdAndUpdate(
                messageId,
                {
                    $pull: { reaction: { _id: reactionId } },
                },
                { new: true }
            );

            return {
                success: true,
                message: "Reaction removed successfully!",
                data: removeReaction,
            };
        }

        return {
            success: false,
            message: "Invalid type provided!",
        };
    } catch (error) {
        logger.log(level.error, `addReaction Error: ${beautify(error.message)}`);
        return { code: 500, success: false, message: error.message };
    }
};

// Generate Agora Token
export const generateAgoraToken = async (req, res) => {
    try {
        const { channelName } = req.body;
        const uid = req.userdata._id; // Assuming authentication middleware sets req.userdata

        if (!channelName) {
            return res
                .status(400)
                .json({ success: false, message: "channelName is required" });
        }

        const APP_ID = process.env.AGORA_APP_ID;
        const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;

        if (!APP_ID || !APP_CERTIFICATE) {
            return res.status(500).json({
                success: false,
                message: "Agora App ID and Certificate are not configured",
            });
        }

        const role = RtcRole.PUBLISHER;
        const expirationTimeInSeconds = 3600; // Token valid for 1 hour
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

        // Use 0 for the uid if you don't have a numeric user ID
        const uidAsNumber = 0;

        const token = RtcTokenBuilder.buildTokenWithUid(
            APP_ID,
            APP_CERTIFICATE,
            channelName,
            uidAsNumber,
            role,
            privilegeExpiredTs
        );

        return res
            .status(200)
            .json({ success: true, token, appId: APP_ID, channelName });
    } catch (error) {
        console.error("generateAgoraToken Error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Get Favourite Therapies
export const getFavouriteTherapies = async (req, res) => {
  try {
    const { query } = req;
    const { type = FAVORITE_CONTENT_TYPE.THERAPY, option = {} } = query;

    logger.log(level.info, `getFavouriteTherapies`);

    const filter = { user_id: req.userdata._id, content_type: type };

    const favouriteTherapyIds = (await Favorites.find(filter, null, option)).map(elem => elem.favourite_id);
    const count = await Favorites.countDocuments(filter);

    let modelName = Therapy;
    switch (Number(type)) {
      case FAVORITE_CONTENT_TYPE.THERAPY:
        modelName = Therapy;
        break;
      case FAVORITE_CONTENT_TYPE.RESOURCE:
        modelName = Resource;
        break;
      default:
        return res.status(400).json({
            success: false,
            message: "Invalid content type!",
        });
    }

    let records = await modelName.find({ _id: { $in: favouriteTherapyIds }, is_deleted: false }).lean();

    if (type == FAVORITE_CONTENT_TYPE.THERAPY) {
      let therapy_ids = records.map(item => item._id);
      const filterProgress = { user_id: toObjectId(req.userdata._id), therapy_id: { $in: therapy_ids } };
      let progressPipeline = await getProgressOfTherapies(filterProgress);
      const progress = await UserProgress.aggregate(progressPipeline);
      let ratings = await ReviewRating.find(filterProgress).lean();
      records = await integrateProgressWithTherapy(progress, records, ratings);
    }

    return okResponse(res, messages.record_fetched, records, count);
  } catch (error) {
    logger.log(level.error, `getFavouriteTherapies Error: ${beautify(error.message)}`);
    return internalServerError(res, error);
  }
};

// Submit Help and Feedback
export const submitHelpAndFeedback = async (req, res) => {
  try {
    const { body, file } = req;
    const { title, description } = body;

    const slugS3Folder = process.env.Aws_Upload_Path_For_Slug;
    const fileName = generateRandomString();
    let filePath;

    if (file) {
      filePath = Path.parse(file.originalname);

      if (!(Object.values({ ...IMAGE_EXTENSIONS, ...AUDIO_VIDEO_EXTENSIONS, ...DOC_EXTENSIONS }).includes(filePath.ext))) {
        logger.log(level.info, 'submitHelpAndFeedback invalid file selection error')
        return badRequestError(res, messages.invalid_file_selected);
      }
    }

    logger.log(level.info, `submitHelpAndFeedback body=${beautify(body)}`);

    const feedback = await Slug.create({ title, description, content_type: SLUG_TYPE.HELP_FEEDBACK, user_id: req.userdata._id });
    if (!feedback) {
      logger.log(level.info, `submitHelpAndFeedback Error`)
      return badRequestError(res, messages.invalid_input);
    }

    if (file) {
      const s3Location = `${slugS3Folder}thumbnail/${fileName}${filePath.ext}`;
      await uploadFileToS3(process.env.Aws_Bucket_Name, s3Location, file);
      await Slug.findByIdAndUpdate(feedback._id, { url: s3Location });
      feedback.url = await getSignedUrl(process.env.Aws_Bucket_Name, s3Location);
    }

    logger.log(level.info, `submitHelpAndFeedback content=${beautify(feedback)}`);
    return okResponse(res, messages.created.replace("{dynamic}", "Therapy"), feedback);
  } catch (error) {
    logger.log(level.error, `submitHelpAndFeedback Error: ${beautify(error.message)}`);
    return internalServerError(res, error);
  }
};

// Remove Account
export const removeAccount = async (req, res) => {
  try {
    const deletedCondition = { $or: [{ is_deleted: false }, { is_deleted: { $exists: false } }] };
    const filter = { _id: req.userdata._id, ...deletedCondition };
    const notExist = await returnOnNotExist(User, filter, res, "User", messages.not_exist.replace("{dynamic}", "User"));
    if (notExist) return;

    const user = await User.findByIdAndUpdate(req.userdata._id, { is_deleted: true, deleted_at: new Date().toISOString() }, { new: true });
    const userData = await User.findById(req.userdata._id).lean();
    if (userData?.customer_id) {
      const deleteAccount = await stripe.customers.del(userData.customer_id);
      logger.log(level.info, `delete Account in stripe body=${beautify(deleteAccount)}`);
    }
    return okResponse(res, messages.deleted.replace("{dynamic}", "User"), user);
  } catch (error) {
    logger.log(level.error, `removeAccount Error: ${beautify(error.message)}`);
    return internalServerError(res, error);
  }
};

// Send Notification to User
export const sendNotificationToUser = async (req, res) => {
  try {
    const { body, file } = req;
    const { users = [], title = "Notifications", message, isSchedule, schedule_time } = body;

    logger.log(level.info, `sendNotificationToUser body=${beautify(body)}`);

    if (users.length <= 0) {
      logger.log(level.error, `sendNotificationToUser error: Invalid Length of Users in a body`);
      return paramMissingError(res, messages.missing_key.replace("{dynamic}", "User"));
    }
    let imageUrl = "";
    let s3Location = "";
    if (file) {
      const s3Folder = process.env.Aws_Upload_Path_For_Notification;
      const filePath = Path.parse(file.originalname);
      const fileName = generateRandomString();

      if (!(Object.values(IMAGE_EXTENSIONS).includes(filePath.ext))) {
        logger.log(level.info, 'sendNotificationToUser invalid file selection error');
        return badRequestError(res, messages.invalid_file_selected);
      }

      s3Location = `${s3Folder}thumbnail/${fileName}${filePath.ext}`;
      await uploadFileToS3(process.env.Aws_Bucket_Name, s3Location, file);
      imageUrl = await getSignedUrl(process.env.Aws_Bucket_Name, s3Location);
    }
    if (isSchedule === "true") {
      if (!schedule_time) {
        logger.log(level.info, 'send notification schedule_time found error');
        return paramMissingError(res, messages.missing_key.replace("{dynamic}", "schedule_time"));
      }
      const schNotification = await scheduleNotification.create({
        user_ids: [...users],
        title,
        description: message,
        image: s3Location,
        schedule_time,
        isSchedule,
        isSend: false
      });
      return okResponse(res, messages.schedule_create, schNotification);
    } else {
      const userTokens = await UserToken.find({ user_id: { $in: users }, is_loggedOut: false }).lean();
      if (userTokens.length) {
        const deviceTokens = userTokens.map(token => token.device_token);
        logger.log(level.info, `sendNotificationToUser notification Tokens = ${beautify(deviceTokens)}`);
        const payload = {
          notification: {
            title: title,
            body: message,
            image: imageUrl || ""
          }
        };
        const result = await sendPushNotification(deviceTokens, payload, "high");
        let notification;
        if (result) {
          notification = await Notification.create({
            user_ids: [...users],
            title,
            description: message,
            image: imageUrl || "",
            schedule_time: null
          });
        }
        return okResponse(res, messages.notification_sent, notification || {});
      } else {
        return okResponse(res, messages.notification_sent, {});
      }
    }
  } catch (error) {
    logger.log(level.error, `sendNotificationToUser Error: ${beautify(error.message)}`);
    return internalServerError(res, error);
  }
};

// Deep Linking
export const deepLinking = async (req, res) => {
  try {
      const deepLink = {
        fallback: 'https://wellheal.app/',
        android_package_name: 'com.app.wellheal',
        ios_store_link: 'https://apps.apple.com/in/app/apple-store/id1661262276'
      };
      return okResponse(res, "Deep link detail", deepLink);
  } catch (error) {
    logger.log(level.error, `deepLinking Error: ${beautify(error.message)}`);
    return internalServerError(res, error);
  }
};

// Device ID Exists
export const deviceidExists = async (req, res) => {
  try {
    const { query } = req;
    const { device_id } = query;

    if (!device_id) {
      return paramMissingError(res, messages.missing_key.replace("{dynamic}", "device_id"));
    }

    const userDevicesIdData = await UserDevices.find({ device_id }).lean();

    if (userDevicesIdData.length > 0) {
      return okResponse(res, messages.deviceid_exist, { is_exists: true });
    } else {
      await UserDevices.create({ device_id });
      return okResponse(res, messages.created.replace('{dynamic}', 'DeviceId'), { is_exists: false });
    }
  } catch (error) {
    logger.log(level.error, `deviceidExists Error: ${beautify(error.message)}`);
    return internalServerError(res, error);
  }
};

// Helper Function to Integrate Progress with Therapy
function integrateProgressWithTherapy(progress = [], therapies = [], ratings = []) {
  let progressMap = {}, ratingMap = {};
  progress.forEach(therapy => {
    progressMap[therapy.therapy_id.toString()] = therapy.completed;
    ratingMap[therapy.therapy_id.toString()] = therapy.is_review_submitted;
  });
  ratings.forEach(therapy => {
    ratingMap[therapy.therapy_id.toString()] = true;
  });
  logger.log(level.info, `integrateProgressWithTherapy progresses: ${beautify(progressMap)}`);
  therapies = JSON.parse(JSON.stringify(therapies));

  therapies = therapies.map(therapy => {
    const therapyIdStr = therapy._id.toString();
    therapy['completed'] = progressMap[therapyIdStr] || 0;
    therapy['is_review_submitted'] = ratingMap[therapyIdStr] || false;
    return therapy;
  });
  return therapies;
}
