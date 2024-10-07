import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import moment from 'moment';
import Doctor from '../models/doctor.model.js';
import DoctorAvailability from '../models/doctor_availability.model.js';
import Mode from '../models/mode.model.js';
import User from '../models/user.model.js';
import Message from "../models/message.model.js";
import ChatList from "../models/chatlist.model.js";
import Appointment from '../models/appointment.model.js';
import DoctorTokenModel from '../models/doctor_token.model.js';
import { logger, level } from '../config/logger.js';
import CallReviewRating from '../models/call_review_rating.model.js';
import Call from '../models/call.model.js';
import Razorpay from 'razorpay';
import { USER_ROLE, ROLE_MAPPING } from '../shared/constant/types.const.js';
// Doctor login
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export async function login(req, res) {
    try {
        const { email, password } = req.body;

        logger.log(`Login request received for email: ${email}`);

        // Find the doctor by email
        const doctor = await Doctor.findOne({ email: email });

        if (!doctor) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        // Compare password
        const isPasswordValid = await bcrypt.compare(password, doctor.password);

        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        // Generate a new token
        const token = jwt.sign(
            { _id: doctor._id, role: doctor.role, email: doctor.email, userId: doctor._id },
            process.env.JWT_TOKEN_SECRET,
            { expiresIn: '1h' }
        );

        logger.log(`JWT_SECRET during login: ${process.env.JWT_SECRET}`);
        logger.log(`Token generated: ${token}`);

        // Save the token in the DoctorToken collection
        const newDoctorToken = new DoctorTokenModel({
            doctor_id: doctor._id,
            device_token: token,
        });

        await newDoctorToken.save();

        logger.log(`Token saved in database for doctor: ${doctor._id}`);

        return res.status(200).json({
            success: true,
            token: token,
            doctorID: doctor._id,
            message: 'You are successfully logged in'
        });
    } catch (error) {
	logger.log(level.error, `Login error: ${error.message}`);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}
export async function getTransactionHistory(req, res) {
    try {
        const { doctorId, count, page = 1, limit = 10 } = req.body; // Extracting doctorId, count, page, and limit from request body
        
        // Debug: Log input values
        console.log("Input Values:", { doctorId, count, page, limit });
        
        // Validate presence of doctorId
        if (!doctorId) {
            console.log("Doctor ID is missing in the request.");
            return res.status(400).json({
                success: false,
                message: "Doctor ID is required.",
            });
        }

        // Validate doctorId format if using MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(doctorId)) {
            console.log("Invalid Doctor ID format:", doctorId);
            return res.status(400).json({
                success: false,
                message: "Invalid Doctor ID format.",
            });
        }

        // Validate page and limit values
        if (!Number.isInteger(page) || page <= 0) {
            console.log("Invalid Page value:", page);
            return res.status(400).json({
                success: false,
                message: "Page must be a positive integer.",
            });
        }

        if (!Number.isInteger(limit) || limit <= 0) {
            console.log("Invalid Limit value:", limit);
            return res.status(400).json({
                success: false,
                message: "Limit must be a positive integer.",
            });
        }

        // Validate count if provided
        if (count !== undefined && (!Number.isInteger(count) || count <= 0)) {
            console.log("Invalid Count value:", count);
            return res.status(400).json({
                success: false,
                message: "Count must be a positive integer.",
            });
        }

        // Set default count if not provided
        const transactionCount = count || limit;

        // Debug: Log options for Razorpay API
        console.log("Razorpay Options:", { transactionCount, page, limit });

        // Fetch transactions from Razorpay with dynamic count and pagination
        const options = {
            count: transactionCount,
            skip: (page - 1) * limit, // Skip the records for pagination
        };

        const transactions = await razorpay.payments.all(options);

        // Debug: Log all transactions received from Razorpay
        console.log("All Transactions from Razorpay:", JSON.stringify(transactions, null, 2));

        // Filter transactions related to the doctorId and extract userId from the description
        const doctorTransactions = await Promise.all(transactions.items.map(async (payment) => {
            const paymentDescription = payment.description || '';
            const [paymentDoctorId, userId] = paymentDescription.split('_'); // Split description into doctorId and userId
            
            console.log(`Checking payment for doctorId: ${paymentDoctorId} against ${doctorId}`);
            
            // Check if the transaction is related to the doctorId
            if (paymentDoctorId === doctorId && userId) {
                // Fetch user details from the User model using userId
                const user = await User.findById(userId).lean();
        const createdAtDate = payment.created_at
            ? new Date(payment.created_at * 1000).toLocaleString('en-US', { timeZone: 'UTC' }) // Convert to milliseconds and format
            : null;                // Return the transaction along with the user details
                return {
                    ...payment, // Include the payment details
			created_at: createdAtDate,
			user: user ? { _id: user._id || null, name: user.name || null, profile_image: user.profile_image || null } : { _id: null, name: null, profile_image: null }
                };
            }
        }));

        // Filter out any undefined transactions (those that didn't match the doctorId)
        const filteredDoctorTransactions = doctorTransactions.filter(trx => trx !== undefined);

        // Debug: Log filtered transactions for the doctor
        console.log("Filtered Transactions for Doctor:", JSON.stringify(filteredDoctorTransactions, null, 2));

        return res.status(200).json({
            success: true,
            data: filteredDoctorTransactions,
            currentPage: page,
            totalPages: Math.ceil(transactions.items.length / limit),
            message: "Transaction history fetched successfully.",
        });

    } catch (error) {
        console.error("Error fetching transaction history:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error.",
            error: error.message,
        });
    }
}

export const getCallReviewsByDoctor = async (req, res) => {
    try {
        const { doctorId } = req.body;

        // Validate doctorId
        if (!doctorId || !mongoose.Types.ObjectId.isValid(doctorId)) {
            return res.status(400).json({
                success: false,
                message: "A valid doctorId is required.",
            });
        }

        // Optional: Verify that the doctor exists
        const doctor = await Doctor.findById(doctorId).lean();
        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: "Doctor not found.",
            });
        }

        // Fetch all call reviews for the specified doctor
        const reviews = await CallReviewRating.find({ doctorId })
            .populate('userId', 'name profile_image') // Populate user details (adjust fields as needed)
            .populate('callId', 'date timeSlot') // Populate call details (adjust fields as needed)
            .lean();

        // Optionally, calculate average rating
        const totalRatings = reviews.length;
        const averageRating = totalRatings > 0
            ? (reviews.reduce((acc, curr) => acc + curr.rating, 0) / totalRatings).toFixed(2)
            : 0;

        return res.status(200).json({
            success: true,
            data: reviews,
            averageRating,
            message: "Doctor call reviews fetched successfully!",
        });
    } catch (error) {
        console.error("Error fetching doctor call reviews:", error);
        return res.status(500).json({ code: 500, message: error.message });
    }
};
// Doctor Information
export async function getLoggedInUser(req, res) {
    try {
        const userId = req.userdata._id;

        const findUser = await Doctor.findById({ _id: userId }).lean();

        if (!findUser) {
            return res.status(403).send({
                message: "No user found!",
                success: false,
            });
        }

        return res.status(200).send({
            success: true,
            data: findUser,
            message: "User information fetched successfully.!",
        });
    } catch (error) {
        console.log("error====>", error);
        return res.status(500).send({
            success: false,
            error: error.message,
            message: "Something went wrong!",
        });
    }
}

// Set doctor personal information
export async function addPersonalDetail(req, res) {
    try {
        const userId = req.userdata._id;
        const file = req.files?.profileImage[0];
        const fileName = file ? file.filename : null;
        const findUser = await Doctor.findById({ _id: userId }).lean();

        if (!findUser) {
            return res.status(404).send({
                message: "User not found!",
                success: false,
            });
        }

        const addPersonalDetail = await Doctor.findByIdAndUpdate(
            { _id: userId },
            { ...req.body, profileImage: fileName },
            { new: true }
        ).lean();

        return res.status(200).send({
            success: true,
            data: addPersonalDetail,
            message: "Personal information added successfully..!",
        });
    } catch (error) {
        console.log("error====>", error);
        return res.status(500).send({
            success: false,
            error: error.message,
            message: "Something went wrong!",
        });
    }
}

// Set doctor banking information
export async function addBankingDetail(req, res) {
    try {
        const userId = req.userdata._id;

        const findUser = await Doctor.findById({ _id: userId }).lean();

        if (!findUser) {
            return res.status(404).send({
                message: "User not found!",
                success: false,
            });
        }

        const addBankingDetail = await Doctor.findByIdAndUpdate(
            { _id: userId },
            { bankingDetails: { ...req.body } },
            { new: true }
        ).lean();

        return res.status(200).send({
            success: true,
            data: addBankingDetail,
            message: "Banking information added successfully..!",
        });
    } catch (error) {
        console.log("error====>", error);
        return res.status(500).send({
            success: false,
            error: error.message,
            message: "Something went wrong!",
        });
    }
}

// Set doctor availability information
export async function addAvailabilityDetail(req, res) {
    try {
        const userId = req.userdata._id;
        const { date, timeSlots, mode, isAddMonthlySlot } = req.body;

        const findUser = await Doctor.findById(userId).lean();
        if (!findUser) {
            return res.status(404).send({
                message: "User not found!",
                success: false,
            });
        }

        const addTimeSlotsForDate = async (currentDate, timeSlots) => {
            const checkExistDate = await DoctorAvailability.findOne({
                date: currentDate,
                doctorId: userId,
            }).lean();

            if (checkExistDate) {
                const existingSlots = checkExistDate.slot.map(slot => slot.time);
                const validSlots = [];

                for (const newSlot of timeSlots) {
                    const newTimeSlot = moment(newSlot.time, "h:mm A");
                    let isOverlapping = false;

                    for (const existingSlot of checkExistDate.slot) {
                        const existingTimeSlot = moment(existingSlot.time, "h:mm A");
                        const diffInMinutes = Math.abs(newTimeSlot.diff(existingTimeSlot, "minutes"));
                        if (diffInMinutes < 60) {
                            isOverlapping = true;
                            break;
                        }
                    }

                    if (!isOverlapping && !existingSlots.includes(newSlot.time)) {
                        validSlots.push(newSlot);
                    }
                }

                if (validSlots.length > 0) {
                    await DoctorAvailability.findOneAndUpdate(
                        { date: currentDate, doctorId: userId },
                        {
                            $push: { slot: { $each: validSlots } },
                            $set: { mode: mode },
                        },
                        { new: true }
                    );
                }
            } else {
                await new DoctorAvailability({
                    date: currentDate,
                    doctorId: userId,
                    slot: timeSlots,
                    mode,
                }).save();
            }

            return { success: true, message: `Time slot added successfully for ${currentDate}.` };
        };

        if (isAddMonthlySlot) {
            const startDate = moment(date);
            const endDate = moment(date).add(30, 'days');
            const results = [];

            for (let currentDate = startDate; currentDate.isSameOrBefore(endDate); currentDate.add(1, 'day')) {
                const result = await addTimeSlotsForDate(currentDate.format('YYYY-MM-DD'), timeSlots);
                results.push(result);
            }

            return res.status(200).send({
                success: true,
                results,
                message: "Monthly time slots added successfully.",
            });
        } else {
            const result = await addTimeSlotsForDate(date, timeSlots);

            if (!result.success) {
                return res.status(400).send({
                    success: false,
                    message: result.message,
                });
            }

            return res.status(200).send({
                success: true,
                message: result.message,
            });
        }
    } catch (error) {
        console.error("Error:", error);
        return res.status(500).send({
            success: false,
            error: error.message,
            message: "Something went wrong!",
        });
    }
}

// Get Doctor information
export async function aboutDoctorDetail(req, res) {
    try {
        const doctorData = await Doctor.find().lean();

        return res.status(200).send({
            success: true,
            data: doctorData,
            message: "Doctor detail fetched successfully.",
        });
    } catch (error) {
        console.error("Error:", error);
        return res.status(500).send({
            success: false,
            error: error.message,
            message: "Something went wrong!",
        });
    }
}

// Get Filter wise slots
export async function getFilterSlots(req, res) {
    try {
        const userId = req.userdata._id;
        const role = req.userdata.role;
        const { doctorId, date } = req.body;

        logger.log(`Fetching filter-wise slots for user ID: ${userId}, Role: ${role}, Doctor ID: ${doctorId}, Date: ${date}`);

        const findUser = role === 'doctor' ? await Doctor.findById({ _id: userId }).lean() : await User.findById({ _id: userId }).lean();
        logger.log(`User found: ${findUser ? 'Yes' : 'No'}`);

        if (!findUser) {
            logger.log(`User not found with ID: ${userId}`);
            return res.status(404).send({
                message: "User not found!",
                success: false,
            });
        }

        let findSlots;
        if (role === 'user') {
            findSlots = await DoctorAvailability.findOne({
                date,
                doctorId: doctorId,
            })
                .populate({
                    path: "mode",
                    select: "name _id price",
                })
                .lean();
        } else {
            findSlots = await DoctorAvailability.findOne({
                date,
                doctorId: userId,
            })
                .populate({
                    path: "mode",
                    select: "name _id price",
                })
                .lean();
        }

        logger.log(`Slots found: ${findSlots?.slot?.length ? 'Yes' : 'No'}`);

        if (!findSlots || !findSlots.slot?.length) {
            return res.status(200).send({
                message: "No slots added for this date",
                success: false,
            });
        }

const modeDescriptions = {
            "voicecall": "Can make voice call with doctor",
            "videocall": "Can make video call with doctor",
            "chat": "Can make messaging with doctor",
            "offline": "Can make meeting at doctor’s clinic"
        };

        // Normalize mode names and add descriptions
        findSlots.mode = findSlots.mode.map((mode) => {
            const normalizedModeName = mode.name.toLowerCase().replace(/\s+/g, '');
            return {
                ...mode,
                description: modeDescriptions[normalizedModeName] || "No description available"
            };
        });

        // Fetch upcoming available dates
        const upcomingDates = await DoctorAvailability.find({
            doctorId: role === 'user' ? doctorId : userId,
            date: {$gt: date}, // Find dates greater than the current date
            "slot.isBooked": false // Ensure at least one slot is available
        }).select('date -_id').sort({ date: 1 }).lean();

        return res.status(200).send({
            success: true,
            data: findSlots,
            upcomingDates: upcomingDates.map(d => d.date), // Return only the dates
            message: "Slots fetched successfully!",
        });
    } catch (error) {
        logger.log(level.error, `Error fetching filter-wise slots: ${error.message}`);
        return res.status(500).send({
            success: false,
            error: error.message,
            message: "Something went wrong!",
        });
    }
}

// Get doctor slots
export async function getDoctorSlots(req, res) {
    try {
        const userId = req.userdata._id;

        const findUser = await Doctor.findById({ _id: userId }).lean();

        if (!findUser) {
            return res.status(404).send({
                message: "User not found!",
                success: false,
            });
        }

        const findSlots = await DoctorAvailability.findOne({
            doctorId: userId,
        }).lean();

        if (!findSlots || !findSlots.slot?.length) {
            return res.status(200).send({
                message: "No slots added for this date",
                success: false,
            });
        }

        return res.status(200).send({
            success: true,
            data: findSlots,
            message: "Slots fetched successfully..!",
        });
    } catch (error) {
        console.log("error====>", error);
        return res.status(500).send({
            success: false,
            error: error.message,
            message: "Something went wrong!",
        });
    }
}

// Delete slots
export async function deleteSlots(req, res) {
    try {
        const userId = req.userdata._id;
        const slotId = req.params.id;
        const availabilityId = req.body.availabilityId;

        const findUser = await Doctor.findById({ _id: userId }).lean();

        if (!findUser) {
            return res.status(404).send({
                message: "User not found!",
                success: false,
            });
        }

        const findSlots = await DoctorAvailability.findOne({
            _id: availabilityId,
            doctorId: userId,
        }).lean();

        if (!findSlots || !findSlots.slot?.length) {
            return res.status(200).send({
                message: "No slots added for this date",
                success: false,
            });
        }

        await DoctorAvailability.updateOne(
            { _id: availabilityId },
            { $pull: { slot: { _id: slotId } } },
            { new: true }
        );

        return res.status(200).send({
            success: true,
            message: "Slot deleted successfully!",
        });
    } catch (error) {
        console.log("error====>", error);
        return res.status(500).send({
            success: false,
            error: error.message,
            message: "Something went wrong!",
        });
    }
}

// Get all slots
export async function getAllSlots(req, res) {
    try {
        const userId = req.userdata._id;

        const findUser = await Doctor.findById({ _id: userId }).lean();

        if (!findUser) {
            return res.status(404).send({
                message: "User not found!",
                success: false,
            });
        }

        const findSlots = await DoctorAvailability.find({
            doctorId: userId,
        }).lean();

        if (!findSlots.length) {
            return res.status(200).send({
                message: "No slots added for this date",
                success: false,
            });
        }

        return res.status(200).send({
            success: true,
            data: findSlots,
            message: "Slots fetched successfully..!",
        });
    } catch (error) {
        console.log("error====>", error);
        return res.status(500).send({
            success: false,
            error: error.message,
            message: "Something went wrong!",
        });
    }
}

// Add Mode
export async function addMode(req, res) {
    try {
        const userId = req.userdata._id;

        const findUser = await Doctor.findById({ _id: userId }).lean();

        if (!findUser) {
            return res.status(404).send({
                message: "User not found!",
                success: false,
            });
        }

        const addMode = await new Mode({ ...req.body, doctorId: userId }).save();

        return res.status(200).send({
            success: true,
            data: addMode,
            message: "Mode added successfully!",
        });
    } catch (error) {
        console.log("error====>", error);
        return res.status(500).send({
            success: false,
            error: error.message,
            message: "Something went wrong!",
        });
    }
}

// Get Mode
export async function getMode(req, res) {
    try {
        const userId = req.userdata._id;

        const modes = await Mode.find({ doctorId: userId }).lean();

        if (!modes.length) {
            return res.status(404).send({
                message: "Mode not found!",
                success: false,
            });
        }

        return res.status(200).send({
            success: true,
            data: modes,
            message: "Mode fetched successfully!",
        });
    } catch (error) {
        console.log("error====>", error);
        return res.status(500).send({
            success: false,
            error: error.message,
            message: "Something went wrong!",
        });
    }
}

// Update mode
export async function updateMode(req, res) {
    try {
        const id = req.params.id;
        const { name, price } = req.body;

        const findMode = await Mode.findById({ _id: id }).lean();

        if (!findMode) {
            return res.status(404).send({
                message: "Mode not found!",
                success: false,
            });
        }

        const updateMode = await Mode.findByIdAndUpdate(
            { _id: id },
            { $set: { name, price } },
            { new: true }
        );

        return res.status(200).send({
            success: true,
            data: updateMode,
            message: "Mode updated successfully!",
        });
    } catch (error) {
        console.log("error====>", error);
        return res.status(500).send({
            success: false,
            error: error.message,
            message: "Something went wrong!",
        });
    }
}

// Update mode status
export async function updateModeStatus(req, res) {
    try {
        const id = req.params.id;
        const isActive = req.body.isActive;

        const findMode = await Mode.findById({ _id: id }).lean();

        if (!findMode) {
            return res.status(404).send({
                message: "Mode not found!",
                success: false,
            });
        }

        const updateMode = await Mode.findByIdAndUpdate(
            { _id: id },
            { isActive },
            { new: true }
        );

        return res.status(200).send({
            success: true,
            data: updateMode,
            message: "Mode status updated successfully!",
        });
    } catch (error) {
        console.log("error====>", error);
        return res.status(500).send({
            success: false,
            error: error.message,
            message: "Something went wrong!",
        });
    }
}
//import mongoose from 'mongoose';

// Get appointments
//import moment from 'moment'; // Assuming moment.js is available for date formatting

export async function getAppointments(req, res) {
    try {
        const userId = req.userdata._id;
        console.log('User ID:', userId);

        const searchStatus = req.query.searchStatus;
        console.log('Search Status:', searchStatus);

        // Check if the doctor exists
        const checkExistUser = await Doctor.findById({ _id: userId }).lean();
        console.log('Doctor found:', checkExistUser);

        if (!checkExistUser) {
            console.log('User not found.');
            return res.status(400).json({
                success: false,
                message: "User not found, Please try again!",
            });
        }

        const doctorObjectId = mongoose.Types.ObjectId(userId);
        console.log('Doctor ObjectId:', doctorObjectId);

        // Initialize the pipeline with a match for doctorId and status
        let matchStage = {
            $match: {
                doctorId: doctorObjectId
            }
        };
        if (searchStatus) {
            matchStage.$match.status = { $regex: new RegExp('^' + searchStatus + '$', 'i') };
        }
        console.log('Match Stage:', JSON.stringify(matchStage, null, 2));

        let pipeline = [matchStage];
        console.log('Pipeline after adding match stage:', JSON.stringify(pipeline, null, 2));

        // Proceed with the pipeline
        pipeline = pipeline.concat([
            // Lookup mode details
            {
                $lookup: {
                    from: 'modes',
                    localField: 'modeId',
                    foreignField: '_id',
                    as: 'modeDetails'
                }
            },
            { $unwind: { path: '$modeDetails', preserveNullAndEmptyArrays: true } },
            
            // Lookup timeSlot details from doctoravailabilities
            {
                $lookup: {
                    from: 'doctoravailabilities',
                    let: { timeSlotId: '$timeSlot' },
                    pipeline: [
                        { $unwind: '$slot' },
                        {
                            $match: {
                                $expr: {
                                    $eq: ['$slot._id', '$$timeSlotId']
                                }
                            }
                        },
                        {
                            $project: {
                                _id: '$slot._id',
                                time: '$slot.time',
                                isBooked: '$slot.isBooked'
                            }
                        }
                    ],
                    as: 'timeSlotDetails'
                }
            },
            { $unwind: { path: '$timeSlotDetails', preserveNullAndEmptyArrays: true } },
            
            // Add formatted date, startTime, endTime fields
            {
                $addFields: {
                    formattedDate: {
                        $cond: {
                            if: { $eq: [{ $type: "$date" }, "string"] },
                            then: {
                                $dateToString: {
                                    format: "%d-%m-%Y",
                                    date: {
                                        $dateFromString: {
                                            dateString: { $substr: ["$date", 0, 24] },
                                            onError: null,
                                            onNull: null
                                        }
                                    },
                                    timezone: "UTC"
                                }
                            },
                            else: "$date"
                        }
                    },
                    formattedStartTime: {
                        $cond: {
                            if: { $eq: [{ $type: "$startTime" }, "string"] },
                            then: {
                                $dateToString: {
                                    format: "%H:%M",
                                    date: {
                                        $dateFromString: {
                                            dateString: { $substr: ["$startTime", 0, 24] },
                                            onError: null,
                                            onNull: null
                                        }
                                    },
                                    timezone: "UTC"
                                }
                            },
                            else: "$startTime"
                        }
                    },
                    formattedEndTime: {
                        $cond: {
                            if: { $eq: [{ $type: "$endTime" }, "string"] },
                            then: {
                                $dateToString: {
                                    format: "%H:%M",
                                    date: {
                                        $dateFromString: {
                                            dateString: { $substr: ["$endTime", 0, 24] },
                                            onError: null,
                                            onNull: null
                                        }
                                    },
                                    timezone: "UTC"
                                }
                            },
                            else: "$endTime"
                        }
                    }
                }
            }
        ]);

        console.log('Executing full aggregation pipeline.');

        const appointments = await Appointment.aggregate(pipeline);
        console.log('Appointments found:', appointments);

        // Map results to include formatted dates
        const formattedAppointments = appointments.map(appointment => {
            return {
                ...appointment,
                formattedDate: moment(appointment.date).format('DD/MM/YYYY'),
                formattedStartTime: moment(appointment.startTime).format('HH:mm'),
                formattedEndTime: moment(appointment.endTime).format('HH:mm'),
                timeSlotDetails: appointment.timeSlotDetails,
                modeDetails: appointment.modeDetails
            };
        });

        return res.status(200).json({
            success: true,
            data: formattedAppointments,
            message: "Appointments retrieved successfully!",
        });
    } catch (error) {
        console.error("Error in getAppointments:", error);
        logger.log('error', `Error in getAppointments: ${error.message}`);
        return res.status(500).json({ code: 500, message: error.message });
    }
}


// Get patients
export async function getPatients(req, res) {
    try {
        const userId = req.userdata._id;

        const checkExitUser = await Doctor.findById({ _id: userId }).lean();

        if (!checkExitUser) {
            return res.status(400).json({
                success: false,
                message: "User not found, Please try again!",
            });
        }

        const patientsData = await Appointment.find({ status: 'Completed' }).lean();

        return res.status(200).json({
            success: true,
            data: patientsData,
            message: "Patients data fetched successfully!",
        });
    } catch (error) {
        console.log("error", error);
        return res.status(500).json({ code: 500, message: error.message });
    }
}

// Add prescription
export async function addPrescription(req, res) {
    try {
        const userId = req.userdata._id;
        const { id, prescription, prescriptionDate } = req.body;

        const checkExitUser = await Doctor.findById({ _id: userId }).lean();

        if (!checkExitUser) {
            return res.status(400).json({
                success: false,
                message: "User not found, Please try again!",
            });
        }

        const addprescription = await Appointment.findByIdAndUpdate({ _id: id }, { prescription, prescriptionDate }, { new: true }).lean();

        return res.status(200).json({
            success: true,
            data: addprescription,
            message: "Prescription added successfully!",
        });
    } catch (error) {
        console.log("error", error);
        return res.status(500).json({ code: 500, message: error.message });
    }
}

// Get Single Appointment
export async function getSingleAppointment(req, res) {
    try {
        const userId = req.userdata._id;
        const id = req.params.id;
        const checkExitUser = await Doctor.findById({ _id: userId }).lean();

        if (!checkExitUser) {
            return res.status(400).json({
                success: false,
                message: "User not found, Please try again!",
            });
        }

        const getAppointment = await Appointment.findById({ _id: id }).lean();

        return res.status(200).json({
            success: true,
            data: getAppointment,
            message: "Appointment fetched successfully!",
        });
    } catch (error) {
        console.log("error", error);
        return res.status(500).json({ code: 500, message: error.message });
    }
}

// Get Appointment count
export async function appointmentCount(req, res) {
    try {
        const userId = req.userdata._id;

        const checkExitUser = await Doctor.findById({ _id: userId }).lean();

        if (!checkExitUser) {
            return res.status(400).json({
                success: false,
                message: "User not found, Please try again!",
            });
        }

        const completedAppointment = await Appointment.find({ doctorId: userId, status: 'Completed' }).lean();
        const upComingAppointment = await Appointment.find({ doctorId: userId, status: 'Upcoming' }).lean();
        const cancelAppointment = await Appointment.find({ doctorId: userId, status: 'Cancel' }).lean();

        let data = {
            completedAppointment: completedAppointment?.length,
            upComingAppointment: upComingAppointment?.length,
            cancelAppointment: cancelAppointment?.length,
        }

        return res.status(200).json({
            success: true,
            data: data,
            message: "Appointment count fetched successfully!",
        });
    } catch (error) {
        console.log("error", error);
        return res.status(500).json({ code: 500, message: error.message });
    }
}

// Get month and year wise appointment
export async function getMonthYearWiseAppointment(req, res) {
    try {
        const userId = req.userdata._id;
        const monthNames = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];

        const month = monthNames.indexOf(req.query.month);
        const year = parseInt(req.query.year);

        if (month === -1 || isNaN(year)) {
            return res.status(400).json({ code: 400, message: "Invalid month or year" });
        }

        const startDate = new Date(Date.UTC(year, month, 1)).toISOString().split('T')[0];
        const endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)).toISOString().split('T')[0];

        const appointments = await DoctorAvailability.find({
            doctorId: userId,
            date: {
                $gte: startDate,
                $lte: endDate,
            },
        }).select('date slot');

        return res.status(200).json({
            success: true,
            data: appointments,
            message: "Appointments fetched successfully!",
        });
    } catch (error) {
        console.log("error", error);
        return res.status(500).json({ code: 500, message: error.message });
    }
}

// Logout
export async function logout(req, res) {
    try {
        const userId = req.userdata._id;

        if (req.userdata?.role === 'user') {
            await User.findByIdAndUpdate({ _id: userId }, { token: null, isOnline: false }, { new: true }).lean();
        } else {
            await Doctor.findByIdAndUpdate({ _id: userId }, { token: null, isOnline: false }, { new: true }).lean();
        }

        return res.status(200).json({
            success: true,
            message: "Logout successfully!",
        });

    } catch (error) {
        console.log("error", error);
        return res.status(500).json({ code: 500, message: error.message });
    }
}
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

    // Debug: Check ChatList documents for the user
    const chatListDocuments = await ChatList.find({ userId: userObjectId }).lean();
    console.log('ChatList Documents:', chatListDocuments);

    // Aggregation Pipeline with additional debugging
    let pipelineResult = await ChatList.aggregate([{ $match: { userId: userObjectId } }]).exec();
    console.log('After $match:', pipelineResult);

    pipelineResult = await ChatList.aggregate([
      { $match: { userId: userObjectId } },
      { $unwind: "$list" } // Update to use 'list' field
    ]).exec();
    console.log('After $unwind:', pipelineResult);

    pipelineResult = await ChatList.aggregate([
      { $match: { userId: userObjectId } },
      { $unwind: "$list" },
      {
        $lookup: {
          from: "users",
          localField: "list.participantId",
          foreignField: "_id",
          as: "userDetails"
        }
      }
    ]).exec();
    console.log('After $lookup users:', pipelineResult);

    pipelineResult = await ChatList.aggregate([
      { $match: { userId: userObjectId } },
      { $unwind: "$list" },
      {
        $lookup: {
          from: "users",
          localField: "list.participantId",
          foreignField: "_id",
          as: "userDetails"
        }
      },
      {
        $lookup: {
          from: "doctors",
          localField: "list.participantId",
          foreignField: "_id",
          as: "doctorDetails"
        }
      }
    ]).exec();
    console.log('After $lookup doctors:', pipelineResult);

    pipelineResult = await ChatList.aggregate([
      { $match: { userId: userObjectId } },
      { $unwind: "$list" },
      {
        $lookup: {
          from: "users",
          localField: "list.participantId",
          foreignField: "_id",
          as: "userDetails"
        }
      },
      {
        $lookup: {
          from: "doctors",
          localField: "list.participantId",
          foreignField: "_id",
          as: "doctorDetails"
        }
      },
      {
        $lookup: {
          from: "messages",
          localField: "list.lastMessageId",
          foreignField: "_id",
          as: "lastMessageDetails"
        }
      }
    ]).exec();
    console.log('After $lookup messages:', pipelineResult);

    // Execute the full aggregation pipeline
    const aggregationPipeline = [
      { $match: { userId: userObjectId } },
      { $unwind: "$list" },
      {
        $lookup: {
          from: "users",
          localField: "list.participantId",
          foreignField: "_id",
          as: "userDetails"
        }
      },
      {
        $lookup: {
          from: "doctors",
          localField: "list.participantId",
          foreignField: "_id",
          as: "doctorDetails"
        }
      },
      {
        $lookup: {
          from: "messages",
          localField: "list.lastMessageId",
          foreignField: "_id",
          as: "lastMessageDetails"
        }
      },
      {
        $addFields: {
          userDetailsCount: { $size: "$userDetails" },
          doctorDetailsCount: { $size: "$doctorDetails" },
          lastMessageDetailsCount: { $size: "$lastMessageDetails" }
        }
      },
      {
        $addFields: {
          participantRole: {
            $cond: [
              { $gt: ["$userDetailsCount", 0] },
              "User",
              "Doctor"
            ]
          },
          participantInfo: {
            $cond: [
              { $gt: ["$userDetailsCount", 0] },
              { $arrayElemAt: ["$userDetails", 0] },
              { $arrayElemAt: ["$doctorDetails", 0] }
            ]
          },
          lastMessage: {
            $cond: [
              { $gt: ["$lastMessageDetailsCount", 0] },
              { $arrayElemAt: ["$lastMessageDetails", 0] },
              null
            ]
          }
        }
      },
      {
        $project: {
          _id: 1,
          roomId: "$list.roomId",
          participantId: "$list.participantId",
          participantRole: 1,
          participantInfo: {
            $cond: [
              { $eq: ["$participantRole", "User"] },
              { name: "$participantInfo.name", profileImage: "$participantInfo.profile_image" },
              { name: { $concat: ["$participantInfo.firstName", " ", "$participantInfo.lastName"] }, profileImage: "$participantInfo.profileImage" }
            ]
          },
          lastMessage: {
            $cond: [
              { $gt: ["$lastMessageDetailsCount", 0] },
              { message: "$lastMessage.message", date: "$lastMessage.date" },
              { message: "No messages", date: null }
            ]
          },
          userDetailsCount: 1,
          doctorDetailsCount: 1,
          lastMessageDetailsCount: 1
        }
      },
      {
        $sort: { "lastMessage.date": -1 }
      }
    ];

    console.log('Aggregation Pipeline:', JSON.stringify(aggregationPipeline, null, 2));
    logger.log(level.debug, `Aggregation Pipeline: ${JSON.stringify(aggregationPipeline, null, 2)}`);

    // Execute the aggregation pipeline
    const chatLists = await ChatList.aggregate(aggregationPipeline).exec();

    console.log(`Aggregation result count: ${chatLists.length}`);
    logger.log(level.info, `Aggregation result count: ${chatLists.length}`);

    // Log details about each chat for debugging
    if (chatLists.length > 0) {
      chatLists.forEach((chat, index) => {
        console.log(`Chat ${index + 1}:`);
        console.log(JSON.stringify(chat, null, 2));
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
    return res.status(500).json({ success: false, message: error.message });
  }
};
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
