// src/controllers/message.controller.js

import mongoose from 'mongoose';
import Message from '../models/message.model.js';
import User from '../models/user.model.js';
import Doctor from '../models/doctor.model.js';
import Room from '../models/room.model.js';
import ChatList from '../models/chatlist.model.js';
import AWS from 'aws-sdk';
import multer from 'multer';
import multerS3 from 'multer-s3';

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.Aws_S3_Access_key_id,
  secretAccessKey: process.env.Aws_S3_Secret_Access_key,
  region: process.env.Aws_Region, // Your region here (e.g., 'us-east-1')
});

// Configure multer-s3 for file upload
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.Aws_Bucket_Name, // Your S3 bucket name
    acl: 'public-read', // Make uploaded files public
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
      const fileName = `${Date.now().toString()}_${file.originalname}`;
      cb(null, fileName);
    },
  }),
});

/**
 * Controller to handle file uploads to AWS S3.
 * @param {Object} req - The request object containing the file.
 * @param {Object} res - The response object to send back the file URL.
 */
export const uploadFileToS3 = (req, res) => {
  upload.single('file')(req, res, (error) => {
    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    // S3 response data will contain the location of the uploaded file
    const fileUrl = req.file.location;
    
    return res.status(200).json({
      success: true,
      fileUrl,
      message: 'File uploaded successfully!',
    });
  });
};

/**
 * Controller to handle sending messages via Socket.IO.
 * Integrates with Rooms and ChatLists collections.
 * @param {Object} data - The message data containing senderId, receiverId, message, and optional documents.
 * @returns {Object} - The result containing success status and message data.
 */
export const sendMessage = async (data) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { senderId, receiverId, message, documents } = data;

        // Validate input
        if (!senderId || !receiverId || !message) {
            await session.abortTransaction();
            session.endSession();
            return {
                success: false,
                message: "senderId, receiverId, and message are required.",
            };
        }

        // Validate senderId and receiverId format
        if (!mongoose.Types.ObjectId.isValid(senderId) || !mongoose.Types.ObjectId.isValid(receiverId)) {
            await session.abortTransaction();
            session.endSession();
            return {
                success: false,
                message: "Invalid senderId or receiverId format.",
            };
        }

        // Verify that the sender exists and get their role
        const senderUser = await User.findById(senderId).session(session).lean();
        let senderRole;
        if (senderUser) {
            senderRole = "User";
        } else {
            const senderDoctor = await Doctor.findById(senderId).session(session).lean();
            if (senderDoctor) {
                senderRole = "Doctor";
            } else {
                await session.abortTransaction();
                session.endSession();
                return {
                    success: false,
                    message: "Sender not found.",
                };
            }
        }

        // Verify that the receiver exists and get their role
        const receiverUser = await User.findById(receiverId).session(session).lean();
        let receiverRole;
        if (receiverUser) {
            receiverRole = "User";
        } else {
            const receiverDoctor = await Doctor.findById(receiverId).session(session).lean();
            if (receiverDoctor) {
                receiverRole = "Doctor";
            } else {
                await session.abortTransaction();
                session.endSession();
                return {
                    success: false,
                    message: "Receiver not found.",
                };
            }
        }

        // Ensure that sender and receiver roles are either "User" or "Doctor"
        const validRoles = ["User", "Doctor"];
        if (!validRoles.includes(senderRole) || !validRoles.includes(receiverRole)) {
            await session.abortTransaction();
            session.endSession();
            return {
                success: false,
                message: "Invalid senderRole or receiverRole.",
            };
        }

        // Find or create a room for the conversation between sender and receiver
        const participants = [
            { userId: mongoose.Types.ObjectId(senderId), role: senderRole },
            { userId: mongoose.Types.ObjectId(receiverId), role: receiverRole }
        ];

        let room = await Room.findOne({
            participants: {
                $all: participants.map(p => ({
                    userId: p.userId,
                    role: p.role
                })),
                $size: participants.length
            }
        }).session(session);

        if (!room) {
            room = await Room.create([{ participants }], { session });
            room = room[0]; // Since create with array returns an array
        }

        // Create new message
        const newMessage = new Message({
            senderId,
            receiverId,
            roomId: room._id,
            message,
            documents: documents || [],
            date: new Date(),
            senderRole,
            receiverRole,
            isRead: false,
        });

        // Save message to database
        await newMessage.save({ session });

        // Update ChatList for Sender
        await ChatList.findOneAndUpdate(
            { userId: senderId, role: senderRole },
            {
                $set: {
                    "chats.$[elem].lastMessageId": newMessage._id,
                    "chats.$[elem].updatedAt": new Date(),
                }
            },
            {
                arrayFilters: [{ "elem.roomId": room._id }],
                new: true,
                upsert: true,
                session
            }
        );

        // Update ChatList for Receiver
        await ChatList.findOneAndUpdate(
            { userId: receiverId, role: receiverRole },
            {
                $set: {
                    "chats.$[elem].lastMessageId": newMessage._id,
                    "chats.$[elem].updatedAt": new Date(),
                }
            },
            {
                arrayFilters: [{ "elem.roomId": room._id }],
                new: true,
                upsert: true,
                session
            }
        );

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();

        return {
            success: true,
            data: newMessage,
        };

    } catch (error) {
        // Abort the transaction on error
        await session.abortTransaction();
        session.endSession();
        console.error("Error in sendMessage controller:", error);
        return {
            success: false,
            message: error.message,
        };
    }
};

/**
 * Controller to retrieve messages for a specific roomId via Socket.IO.
 * @param {String} roomId - The unique room identifier (ObjectId as string).
 * @param {String} userId - The ID of the user requesting the messages.
 * @param {Number} page - The page number for pagination (optional).
 * @param {Number} limit - The number of messages per page (optional).
 * @returns {Object} - The result containing success status and messages data.
 */
export const getMessages = async (roomId, userId, page = 1, limit = 50) => {
    try {
        // Validate roomId and userId
        if (!roomId || !userId) {
            return {
                success: false,
                message: "roomId and userId are required.",
            };
        }

        // Validate roomId and userId format
        if (!mongoose.Types.ObjectId.isValid(roomId) || !mongoose.Types.ObjectId.isValid(userId)) {
            return {
                success: false,
                message: "Invalid roomId or userId format.",
            };
        }

        // Fetch the room to verify participants
        const room = await Room.findById(roomId).lean();
        if (!room) {
            return {
                success: false,
                message: "Room not found.",
            };
        }

        // Check if the requesting user is part of the room
        const isParticipant = room.participants.some(participant => participant.userId.toString() === userId);
        if (!isParticipant) {
            return {
                success: false,
                message: "You are not authorized to view messages in this room.",
            };
        }

        // Fetch messages with pagination
        let messages = await Message.find({ roomId })
            .sort({ createdAt: 1 }) // Sort messages in ascending order
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        // Collect unique senderIds and receiverIds
        const senderIds = [...new Set(messages.map(msg => msg.senderId.toString()))];
        const receiverIds = [...new Set(messages.map(msg => msg.receiverId.toString()))];

        // Fetch users and doctors in batches
        const users = await User.find({ _id: { $in: senderIds.concat(receiverIds) } }).select('name profile_image role').lean();
        const doctors = await Doctor.find({ _id: { $in: senderIds.concat(receiverIds) } }).select('firstName lastName profileImage role').lean();

        // Create a mapping from userId to user details
        const userMap = {};
        users.forEach(user => {
            userMap[user._id.toString()] = {
                name: user.name,
                profile_image: user.profile_image,
                role: user.role
            };
        });

        // Add doctors to the mapping
        doctors.forEach(doctor => {
            userMap[doctor._id.toString()] = {
                name: `${doctor.firstName} ${doctor.lastName}`,
                profile_image: doctor.profileImage,
                role: doctor.role
            };
        });

        // Populate sender and receiver details in messages
        messages = messages.map(msg => ({
            ...msg,
            sender: userMap[msg.senderId.toString()] || null,
            receiver: userMap[msg.receiverId.toString()] || null,
        }));

        return {
            success: true,
            data: messages,
        };

    } catch (error) {
        console.error("Error in getMessages controller:", error);
        return {
            success: false,
            message: error.message,
        };
    }
};
