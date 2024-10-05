// src/routes/user.route.js

import multer from 'multer';
import { Router } from 'express';
import {
  bookAppointment,
  filterAppointment,
  cancelAppointment,
  rescheduleAppointment,
  userUpdateStatus,
  sendMessage,
  createRoomId,
  getChatList,
  getMessages,
  addReaction,
  getFavouriteTherapies,
  submitHelpAndFeedback,
  removeAccount,
  sendNotificationToUser,
  deepLinking,
  deviceidExists,
  generateAgoraToken,        // Newly added
  getFilterSlots,
  createCallReview,
//  getUserDetails,            // Newly added
//  updateUserProfile,         // Newly added
//  changePassword,            // Newly added
//  logoutUser,                // Newly added
  // Add other methods from user.controller.js here
} from '../controllers/user.controller.js';

import { authMiddleware } from '../shared/middleweres/auth.middlewere.js';

const upload = multer();
const routes = new Router();

const Path = {
  // Device ID check
  deviceidExists: '/deviceidExists',

  // User authentication and profile
  //getUserDetails: '/profile',
  //updateUserProfile: '/profile/update',
  //changePassword: '/change-password',
  //logoutUser: '/logout',

  // Appointment routes
  bookAppointment: '/bookAppointment',
  filterAppointment: '/filterAppointment',
  cancelAppointment: '/cancelAppointment',
  rescheduleAppointment: '/rescheduleAppointment',
  getFilterSlots:'/getFilterSlots',
  // User status
  userUpdateStatus: '/updateStatus',
  createCallReview: '/createCallReview',
  // Chat and messaging
  sendMessage: '/sendMessage',
  createRoomId: '/createRoomId',
  getChatList: '/getChatList',
  getMessages: '/getMessages',
  addReaction: '/message/reaction',
 
  // Agora token generation
  generateAgoraToken: '/generateAgoraToken',

  // Favorite therapies
  getFavouriteTherapies: '/fav/therapy',

  // Feedback submission
  submitHelpAndFeedback: '/feedback/submit',

  // Account management
  removeAccount: '/remove-account',

  // Notifications
  sendNotificationToUser: '/send-notification',

  // Deep linking
  deepLinking: '/deepLinking',
};

// Routes that don't require authentication
routes.get(Path.deviceidExists, deviceidExists);
routes.get(Path.deepLinking, deepLinking);

// Apply authentication middleware to all routes below
routes.use(authMiddleware);

// User profile routes
//routes.get(Path.getUserDetails, getUserDetails);
//routes.put(Path.updateUserProfile, upload.single('profileImage'), updateUserProfile);
//routes.post(Path.changePassword, changePassword);
//routes.post(Path.logoutUser, logoutUser);
routes.post(Path.createCallReview, createCallReview);
// Appointment routes
routes.post(Path.bookAppointment, bookAppointment);
routes.post(Path.filterAppointment, filterAppointment);
routes.post(Path.cancelAppointment, cancelAppointment);
routes.post(Path.rescheduleAppointment, rescheduleAppointment);
routes.post(Path.getFilterSlots, getFilterSlots);
// User status
routes.post(Path.userUpdateStatus, userUpdateStatus);

// Chat and messaging routes
routes.post(Path.sendMessage, sendMessage);
routes.post(Path.createRoomId, createRoomId);
routes.get(Path.getChatList, getChatList);
routes.post(Path.getMessages, getMessages);
routes.post(Path.addReaction, addReaction);

// Agora token generation
routes.post(Path.generateAgoraToken, generateAgoraToken);

// Favorite therapies
routes.get(Path.getFavouriteTherapies, getFavouriteTherapies);

// Feedback submission
routes.post(Path.submitHelpAndFeedback, upload.single('file'), submitHelpAndFeedback);

// Account management
routes.delete(Path.removeAccount, removeAccount);

// Notification routes
routes.post(Path.sendNotificationToUser, upload.single('file'), sendNotificationToUser);

// Export the routes
export default routes;
