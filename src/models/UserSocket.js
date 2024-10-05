// models/UserSocket.js

//const mongoose = require('mongoose');
import mongoose from 'mongoose';
const UserSocketSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  socketId: { type: String, required: true },
});

//module.exports
const UserSocket  = mongoose.model('UserSocket', UserSocketSchema);
export default UserSocket;
