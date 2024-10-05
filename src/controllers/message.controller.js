// src/controllers/message.controller.js

import mongoose from 'mongoose';
import Message from '../models/message.model.js';
import Doctor from '../models/doctor.model.js';
import User from '../models/user.model.js';
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

// Add this method in your message controller
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
 * Utility function to generate a unique roomId based on senderId and receiverId.
 * @param {String} senderId - The ID of the sender.
 * @param {String} receiverId - The ID of the receiver.
 * @returns {String} - The generated roomId.
 */
const generateRoomId = (senderId, receiverId) => {
        let value = [senderId, receiverId];
        value.sort((a, b) => b.localeCompare(a));
        let roomId = value.join();
        return roomId
};

/**
 * Controller to handle sending messages via Socket.IO.
 * @param {Object} data - The message data containing senderId, receiverId, message, and optional documents.
 * @returns {Object} - The result containing success status and message data.
 */
export const sendMessage = async (data) => {
    try {
        const { senderId, receiverId, message, documents } = data;

        // Validate input
        if (!senderId || !receiverId || !message) {
            return {
                success: false,
                message: "senderId, receiverId, and message are required.",
            };
        }

        // Validate senderId and receiverId format
        if (!mongoose.Types.ObjectId.isValid(senderId) || !mongoose.Types.ObjectId.isValid(receiverId)) {
            return {
                success: false,
                message: "Invalid senderId or receiverId format.",
            };
        }

        // Verify that the sender exists
        const senderUser = await User.findById(senderId).lean();
        let senderRole;
        if (senderUser) {
            senderRole = "Users";
        } else {
            const senderDoctor = await Doctor.findById(senderId).lean();
            if (senderDoctor) {
                senderRole = "Doctor";
            } else {
                return {
                    success: false,
                    message: "Sender not found.",
                };
            }
        }

        // Verify that the receiver exists
        const receiverUser = await User.findById(receiverId).lean();
        let receiverRole;
        if (receiverUser) {
            receiverRole = "Users";
        } else {
            const receiverDoctor = await Doctor.findById(receiverId).lean();
            if (receiverDoctor) {
                receiverRole = "Doctor";
            } else {
                return {
                    success: false,
                    message: "Receiver not found.",
                };
            }
        }

        // Generate roomId
        const roomId = generateRoomId(senderId.toString(), receiverId.toString());

        // Create new message
        const newMessage = new Message({
            senderId,
            receiverId,
            roomId,
            message,
            documents: documents || [],
            date: new Date().toISOString(),
            senderRole,
            receiverRole,
            isRead: false,
        });

        // Save message to database
        await newMessage.save();

        return {
            success: true,
            data: newMessage,
        };

    } catch (error) {
        console.error("Error in sendMessage controller:", error);
        return {
            success: false,
            message: error.message,
        };
    }
};

/**
 * Controller to retrieve messages for a specific roomId via Socket.IO.
 * @param {String} roomId - The unique room identifier.
 * @param {String} userId - The ID of the user requesting the messages.
 * @returns {Object} - The result containing success status and messages data.
 */
export const getMessages = async (roomId, userId) => {
    try {
        // Validate roomId and userId
        if (!roomId || !userId) {
            return {
                success: false,
                message: "roomId and userId are required.",
            };
        }

        // Validate roomId format
        const ids = roomId.split('_');
        if (ids.length !== 2 || !mongoose.Types.ObjectId.isValid(ids[0]) || !mongoose.Types.ObjectId.isValid(ids[1])) {
            return {
                success: false,
                message: "Invalid roomId format.",
            };
        }

        // Ensure that the requesting user is part of the room
        if (userId !== ids[0] && userId !== ids[1]) {
            return {
                success: false,
                message: "You are not authorized to view messages in this room.",
            };
        }

        // Fetch messages sorted by creation time
        const messages = await Message.find({ roomId })
            .populate('senderId', 'name profile_image') // Populate sender details
            .populate('receiverId', 'name profile_image') // Populate receiver details
            .sort({ createdAt: 1 }) // Sort messages in ascending order
            .lean();

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
