// src/app.js

import express from 'express';
import cron from 'node-cron';
import './config/database.js';
import './shared/utils/utility.js';
import middlewaresConfig from './config/middlewares.js';
import ApiRoutes from './routes/index.js';
import path from 'path';
import { constants } from './shared/constant/application.const.js';
import logger, { level } from './config/logger.js';
import { scheduleNotificationByCron } from './cron/schedule_notification.js';
import { autoEndFreeTrial } from './cron/autoEndFreeTrial.js';
import { subscriptionFreeTrialEnd } from './cron/subscriptionFreeTrialEnd.js';
import { subscriptionPlanCancelByUserPlanAutoEnd, subscriptionAutoEndNonCancel } from './cron/subscriptionAutoEnd.js';
import dotenv from 'dotenv';
dotenv.config();
console.log("Loaded Environment Variables: ", process.env);
import cors from 'cors';
import http from "http";
import { Server } from "socket.io";
import {
  sendMessage,
  getMessages,
  uploadFileToS3, // Ensure all necessary controllers are imported
} from "./controllers/message.controller.js";
import UserSocket from './models/UserSocket.js';
import Call from './models/call.model.js';
import { generateAgoraToken } from './shared/services/agoraToken.service.js';
import mongoose from 'mongoose';

// Resolve the directory name
const __dirname = path.resolve();

// Initialize Express app
const app = express();
app.use(cors());
middlewaresConfig(app);

app.set('views', path.join(__dirname, 'src', 'views'));
app.set('view engine', 'ejs');
app.use(express.static('src/public'));

app.use('/api', ApiRoutes);

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO server with authentication middleware (if any)
const io = new Server(server, {
  cors: {
    origin: "*", // Adjust as necessary for production
    methods: ["GET", "POST"]
  }
});
console.log('Socket.IO server initialized');

// In-memory store for online users and active calls
const onlineUsers = {}; // { userId: Set(socketId) }
const activeCalls = {};  // { roomId: callId }

// Utility function to generate a unique roomId based on senderId and receiverId
const generateRoomId = (senderId, receiverId) => {
  const sortedIds = [senderId, receiverId].sort(); // Lexicographical sort
  return `${sortedIds[0]}_${sortedIds[1]}`; // Join with underscore
};

// Socket.IO event handling
io.on('connection', (socket) => {
  console.log('A user connected: ', socket.id);

  // Handle 'joinRoom' event
  socket.on('joinRoom', async (data) => {
    try {
      const { roomId, userId, userRole } = data;

      if (!roomId || !userId || !userRole) {
        return socket.emit('joinRoomError', { success: false, message: "roomId, userId, and userRole are required to join a room." });
      }

      // Join the specified room
      socket.join(roomId);
      console.log(`Socket ${socket.id} joined room ${roomId}`);

      // Update in-memory onlineUsers
      if (onlineUsers[userId]) {
        onlineUsers[userId].add(socket.id);
      } else {
        onlineUsers[userId] = new Set([socket.id]);
        // Notify others that this user is now online
        io.emit('userOnline', { userId, userRole });
      }

      // Optionally, fetch and send existing messages in the room
      const messagesResult = await getMessages(roomId, userId);
      if (messagesResult.success) {
        socket.emit('messageHistory', messagesResult.data);
      } else {
        socket.emit('joinRoomError', { success: false, message: messagesResult.message });
        return;
      }

      socket.emit('joinRoomSuccess', { success: true, message: `Joined room ${roomId} successfully.` });

    } catch (error) {
      console.error("Error in joinRoom event:", error);
      socket.emit('joinRoomError', { success: false, message: "Failed to join room." });
    }
  });

  // Handle 'sendMessage' event
  socket.on('sendMessage', async (data) => {
    console.log('sendMessage event received:', data);
    try {
      const result = await sendMessage(data);
      if (result.success) {
        const roomId = result.data.roomId;
        // Emit 'newMessage' to the specific room
        io.to(roomId).emit('newMessage', result.data);
        socket.emit('sendMessageSuccess', { success: true, message: 'Message sent successfully!' });
        console.log(`Message broadcasted to room ${roomId}.`);
      } else {
        socket.emit('sendMessageError', { success: false, message: result.message });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('sendMessageError', { success: false, message: 'Failed to send message' });
    }
  });

  // Handle 'startCall' event
  socket.on('startCall', async (data) => {
    try {
      const { doctorId, userId, appointmentId, timeSlot, callType } = data;

      // Validate required fields
      if (!doctorId || !userId || !appointmentId || !timeSlot || !callType) {
        return socket.emit('startCallError', { success: false, message: "Missing required call parameters." });
      }

      // Validate ObjectIds
      if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
        return socket.emit('startCallError', { success: false, message: "Invalid appointmentId." });
      }
      if (!mongoose.Types.ObjectId.isValid(timeSlot)) {
        return socket.emit('startCallError', { success: false, message: "Invalid timeSlot." });
      }

      // Generate roomId
      const roomId = generateRoomId(doctorId.toString(), userId.toString());

      // Check if a call is already active in this room
      if (activeCalls[roomId]) {
        return socket.emit('startCallError', { success: false, message: "A call is already active in this room." });
      }

      // Generate Agora channel name (unique identifier)
      const agoraChannel = `channel_${new mongoose.Types.ObjectId()}`;

      // Generate Agora token using the service
      const agoraToken = generateAgoraToken(agoraChannel, userId);

      // Create a new call record in the database
      const newCall = new Call({
        doctorId,
        userId,
        appointmentId,
        date: new Date(),
        timeSlot,
        status: "In-Call",
        startTime: new Date(),
        callType,
        agoraChannel,
        agoraToken,
      });

      await newCall.save();
      activeCalls[roomId] = newCall._id;

      // Emit 'callStarted' event to both doctor and user
      io.to(roomId).emit('callStarted', {
        callId: newCall._id,
        agoraChannel: newCall.agoraChannel,
        agoraToken: newCall.agoraToken,
        callType: newCall.callType,
      });

      socket.emit('startCallSuccess', { success: true, message: "Call started successfully.", data: newCall });

    } catch (error) {
      console.error('Error starting call:', error);
      socket.emit('startCallError', { success: false, message: 'Failed to start call.' });
    }
  });

  // Handle 'endCall' event
  socket.on('endCall', async (data) => {
    try {
      const { callId } = data;

      if (!callId) {
        return socket.emit('endCallError', { success: false, message: "callId is required to end a call." });
      }

      const call = await Call.findById(callId);

      if (!call) {
        return socket.emit('endCallError', { success: false, message: "Call not found." });
      }

      // Generate roomId based on doctorId and userId
      const roomId = generateRoomId(call.doctorId.toString(), call.userId.toString());

      // Check if the call is active
      if (!activeCalls[roomId] || activeCalls[roomId].toString() !== callId.toString()) {
        return socket.emit('endCallError', { success: false, message: "Call is not active or already ended." });
      }

      // Update call details
      call.status = "Completed";
      call.endTime = new Date();
      call.duration = Math.round((call.endTime - call.startTime) / 1000); // Duration in seconds

      await call.save();

      // Remove the call from activeCalls
      delete activeCalls[roomId];

      // Emit 'callEnded' event to both doctor and user
      io.to(roomId).emit('callEnded', {
        callId: call._id,
        status: call.status,
        endTime: call.endTime,
        duration: call.duration,
      });

      socket.emit('endCallSuccess', { success: true, message: "Call ended successfully.", data: call });

    } catch (error) {
      console.error('Error ending call:', error);
      socket.emit('endCallError', { success: false, message: 'Failed to end call.' });
    }
  });

  /**
   * Handle 'getMessages' event.
   * Client emits this event with { roomId, userId } to receive the last 10 messages.
   */
  socket.on('getMessages', async (data) => {
    try {
      const { roomId, userId } = data;

      if (!roomId || !userId) {
        return socket.emit('getMessagesError', { success: false, message: "roomId and userId are required." });
      }

      // Fetch the last 10 messages
      const messagesResult = await getMessages(roomId, userId, 10);

      if (messagesResult.success) {
        // Send the messages back to the requesting client
        socket.emit('getMessagesSuccess', { success: true, messages: messagesResult.data });
      } else {
        socket.emit('getMessagesError', { success: false, message: messagesResult.message });
      }

    } catch (error) {
      console.error("Error in getMessages event:", error);
      socket.emit('getMessagesError', { success: false, message: "Failed to fetch last 10 chats." });
    }
  });

  // Handle disconnection
  socket.on('disconnect', async () => {
    console.log('A user disconnected: ', socket.id);

    // Find the userId associated with this socket.id
    let userIdToRemove = null;
    for (const [userId, socketSet] of Object.entries(onlineUsers)) {
      if (socketSet.has(socket.id)) {
        socketSet.delete(socket.id);
        userIdToRemove = userId;
        if (socketSet.size === 0) {
          delete onlineUsers[userId];
          // Notify others that this user is now offline
          io.emit('userOffline', { userId });
        }
        break;
      }
    }

    if (userIdToRemove) {
      console.log(`User ${userIdToRemove} has disconnected. Remaining sockets: ${onlineUsers[userIdToRemove] ? onlineUsers[userIdToRemove].size : 0}`);

      // Find all rooms the disconnected user was part of
      const rooms = Array.from(socket.rooms).filter(room => room !== socket.id);

      for (const roomId of rooms) {
        // Check if there's an active call in this room
        if (activeCalls[roomId]) {
          try {
            const call = await Call.findById(activeCalls[roomId]);

            if (call && call.status === "In-Call") {
              // Update call details
              call.status = "Completed";
              call.endTime = new Date();
              call.duration = Math.round((call.endTime - call.startTime) / 1000); // Duration in seconds

              await call.save();

              // Remove the call from activeCalls
              delete activeCalls[roomId];

              // Emit 'callEnded' event to the room
              io.to(roomId).emit('callEnded', {
                callId: call._id,
                status: call.status,
                endTime: call.endTime,
                duration: call.duration,
                reason: "User disconnected", // Optional: reason for call ending
              });

              console.log(`Call ${call._id} ended due to user disconnection in room ${roomId}.`);
            }
          } catch (error) {
            console.error(`Error ending call due to disconnection in room ${roomId}:`, error);
          }
        }
      }
    }
  });
});

// Start listening on the HTTP server
server.listen(constants.PORT, () => {
  logger.log(level.info, `SERVER RUNNING ON PORT ${constants.PORT}`);
});

export default app;
