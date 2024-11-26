import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import moment from 'moment';
import Doctor from '../models/doctor.model.js';
import DoctorAvailability from '../models/doctor_availability.model.js';
import Mode from '../models/mode.model.js';
import User from '../models/user.model.js';
import Appointment from '../models/appointment.model.js';
import DoctorTokenModel from '../models/doctor_token.model.js';
import { logger, level } from '../config/logger.js';
import { unlinkSync, renameSync } from 'fs'

// Doctor login
export async function login(req, res) {
    try {
        const { email, password } = req.body;

        logger.log(`Login request received for email: ${email}`);

        // Validate request data
        if (!email || !password) {
            logger.log(`Missing email or password in request`);
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        // Log the connection state
//        const mongooseConnectionState = mongoose.connection.readyState;
//        logger.log(`Mongoose connection state: ${mongooseConnectionState}`); // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting

        // Check total number of doctors
        const doctorCount = await Doctor.countDocuments();
        logger.log(`Total number of doctors in the database: ${doctorCount}`);

        // Optionally log all emails (for debugging only)
        // WARNING: Uncomment only in a secure, non-production environment
        /*
        const allDoctors = await Doctor.find({}, 'email');
        logger.log(`All registered doctor emails: ${allDoctors.map(doc => doc.email).join(', ')}`);
        */

        // Execute the query
        logger.log(`Executing Doctor.findOne with email: ${email}`);
        const doctor = await Doctor.findOne({ email: email });

        if (!doctor) {
            logger.log(`No doctor found with email: ${email}`);
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        logger.log(`Doctor found: ${doctor._id}`);

        // Compare password
        const isPasswordValid = bcrypt.compare(password, doctor.password);

        if (!isPasswordValid) {
            logger.log(`Invalid password for doctor ID: ${doctor._id}`);
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        logger.log(`Password valid for doctor ID: ${doctor._id}`);

        // Ensure JWT_TOKEN_SECRET is set
        if (!process.env.JWT_TOKEN_SECRET) {
            logger.log('JWT_TOKEN_SECRET is not defined');
            throw new Error('JWT_TOKEN_SECRET is missing');
        } else {
            logger.log('JWT_TOKEN_SECRET is set');
        }

        // Generate a new token
        const token = jwt.sign(
            { _id: doctor._id, role: doctor.role, email: doctor.email, userId: doctor._id },
            process.env.JWT_TOKEN_SECRET,
            { expiresIn: '1h' }
        );

        logger.log(`Token generated for doctor ID ${doctor._id}: ${token}`);

        // Save the token in the DoctorToken collection
        const newDoctorToken = new DoctorTokenModel({
            doctor_id: doctor._id,
            device_token: token,
        });

        await newDoctorToken.save();
        logger.log(`Token saved in database for doctor ID: ${doctor._id}`);

        logger.log(`Doctor ID ${doctor._id} successfully logged in`);

        return res.status(200).json({
            success: true,
            token: token,
            doctorID: doctor._id,
            message: 'You are successfully logged in'
        });
    } catch (error) {
        logger.log(level.error, `Login error: ${error.message}`, { stack: error.stack });
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}



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
        const file = req.files?.profileImage ? req.files.profileImage[0] : null;
        // const fileName = file ? file.filename : null; // REMOVE THIS. NO LONGER NEEDED
        const findUser = await Doctor.findById({ _id: userId }).lean();

        if (!findUser) {
            return res.status(404).send({
                message: "User not found!",
                success: false,
            });
        }
        
        let fileName;
        const photo = file;
        // check if photo is sent alongside other form data
        if (photo) {
            //check if file uploaded is an image and delete file from server if it's not an image file
            if(photo.mimetype.split("/")[0] !== "image"){
                unlinkSync(`${photo.destination}/${photo.filename}`);
                throw new Error("File uploaded is not an image");
            }
            fileName = `${photo.filename}.png`;
            const mediaDestination = `../public/profileImages/`
            renameSync(`${photo.destination}/${photo.filename}`, `${mediaDestination}${fileName}`);
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

// Set doctor personal information
export async function addOtherDoctor(req, res) {
    try {
        const userId = req.userdata._id;
        const file = req.files?.profileImage ? req.files.profileImage[0] : null;
        
        const existingUser = await Doctor.findOne({ email: req.body.email }).lean();
        if(existingUser){
            throw new Error("A doctor with this email already exists");
        }
        console.log("exist data", existingUser);
        console.log("my data", req.userdata);
        console.log("my data again", req.body);
        
        let fileName;
        const photo = file;
        // check if photo is sent alongside other form data
        if (photo) {
            //check if file uploaded is an image and delete file from server if it's not an image file
            if(photo.mimetype.split("/")[0] !== "image"){
                unlinkSync(`${photo.destination}/${photo.filename}`);
                throw new Error("File uploaded is not an image");
            }
            fileName = `${photo.filename}.png`;
            const mediaDestination = `../public/profileImages/`
            renameSync(`${photo.destination}/${photo.filename}`, `${mediaDestination}${fileName}`);
        }

        const addPersonalDetail = await Doctor.create(
            { ...req.body, profileImage: fileName, token: null },
            { new: true }
        );

        return res.status(200).send({
            success: true,
            data: addPersonalDetail,
            message: "New doctor information added successfully..!",
        });
    } catch (error) {
        console.log("error====>", error);
        return res.status(500).send({
            success: false,
            error: error.message,
            message: error.message,
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
        const doctorId = req.body.doctorId;
        const date = req.body.date;
        let findSlots;

        const findUser = role === 'doctor' ? await Doctor.findById({ _id: userId }).lean() : await User.findById({ _id: userId }).lean();

        if (!findUser) {
            return res.status(404).send({
                message: "User not found!",
                success: false,
            });
        }

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

        if (!findSlots || !findSlots.slot?.length) {
            return res.status(200).send({
                message: "No slots added for this date",
                success: false,
            });
        }

        return res.status(200).send({
            success: true,
            data: findSlots,
            message: "Slots fetched successfully!",
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
        const { name, price, currency } = req.body;

        const findMode = await Mode.findById({ _id: id }).lean();

        if (!findMode) {
            return res.status(404).send({
                message: "Mode not found!",
                success: false,
            });
        }

        const updateMode = await Mode.findByIdAndUpdate(
            { _id: id },
            { $set: { name, price, currency } },
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

// Get appointments
export async function getAppointments(req, res) {
    try {
        const userId = req.userdata._id;
        const searchStatus = req.query.searchStatus;

        const checkExistUser = await Doctor.findById({ _id: userId }).lean();

        if (!checkExistUser) {
            return res.status(400).json({
                success: false,
                message: "User not found, Please try again!",
            });
        }

        let pipeline = [
            {
                $lookup: {
                    from: 'modes',
                    localField: 'modeId',
                    foreignField: '_id',
                    pipeline: [
                        { $project: { _id: 1, name: 1 } }
                    ],
                    as: 'modeId'
                }
            },
            { $unwind: '$modeId' },
            {
                $lookup: {
                    from: 'doctoravailabilities',
                    let: { timeSlotId: '$timeSlot' },
                    pipeline: [
                        { $unwind: '$slot' },
                        { $match: { $expr: { $eq: ['$slot._id', '$$timeSlotId'] } } },
                        { $project: { _id: '$slot._id', time: '$slot.time', isBooked: '$slot.isBooked' } }
                    ],
                    as: 'timeSlot'
                }
            },
            { $unwind: '$timeSlot' }
        ];

        if (searchStatus) {
            pipeline.push({
                $match: { status: searchStatus }
            });
        }

        const appointments = await Appointment.aggregate(pipeline);

        return res.status(200).json({
            success: true,
            data: appointments,
            message: "Appointments retrieved successfully!",
        });
    } catch (error) {
        console.log("error", error);
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

        const monthIndex = parseInt(req.query.month)-1; // Convert to number and adjust for zero-based index
        const month = monthNames[monthIndex]; // changed from getting indexOf to getting value with index
        const year = parseInt(req.query.year);

        if (month === -1 || isNaN(year)) {
            return res.status(400).json({ code: 400, message: "Invalid month or year" });
        }

        const startDate = new Date(Date.UTC(year, monthIndex, 1)).toISOString().split('T')[0]; // changed month (string) to monthIndex (number)
        const endDate = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999)).toISOString().split('T')[0]; // changed month (string) to monthIndex (number)

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
