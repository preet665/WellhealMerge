// seed.js

import mongoose from 'mongoose';
import ChatList from './models/chatlist.model.js';
import Message from './models/message.model.js';
import Room from './models/room.model.js';

// Replace with your actual MongoDB connection string
const MONGODB_URI = 'mongodb+srv://preet665665:preet665665@workshop-bakery.rskd9oe.mongodb.net/wellheal'; // Example: 'mongodb://username:password@localhost:27017/wellheal'

// Predefined IDs
const DOCTOR_ID = '6685e6c3980592ee5098eb34';
const USER_ID = '66f5e6aa9679853bd852b37b';

// Function to seed data
async function seed() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Clear existing data (Optional: Use with caution)
    await ChatList.deleteMany({});
    await Message.deleteMany({});
    await Room.deleteMany({});
    console.log('✅ Cleared existing data');

    // Create Room
    const room = await Room.createRoom([
      { userId: mongoose.Types.ObjectId(DOCTOR_ID), role: 'Doctor' },
      { userId: mongoose.Types.ObjectId(USER_ID), role: 'User' },
    ]);
    console.log(`✅ Room Created/Found with ID: ${room._id}`);

    // Create Message
    const message = await Message.create({
      senderId: mongoose.Types.ObjectId(USER_ID),
      receiverId: mongoose.Types.ObjectId(DOCTOR_ID),
      roomId: room._id,
      message: 'Hello Doctor, I need some advice.',
      documents: [],
      senderRole: 'User',
      receiverRole: 'Doctor',
      isRead: false,
    });
    console.log(`✅ Message Created with ID: ${message._id}`);

    // Create ChatList for Doctor
    const chatListDoctor = await ChatList.create({
      userId: mongoose.Types.ObjectId(DOCTOR_ID),
      role: 'Doctor',
      chats: [
        {
          participantId: mongoose.Types.ObjectId(USER_ID),
          role: 'User',
          roomId: room._id,
          lastMessageId: message._id,
        },
      ],
    });
    console.log('✅ ChatList Created for Doctor');

    // Create ChatList for User
    const chatListUser = await ChatList.create({
      userId: mongoose.Types.ObjectId(USER_ID),
      role: 'User',
      chats: [
        {
          participantId: mongoose.Types.ObjectId(DOCTOR_ID),
          role: 'Doctor',
          roomId: room._id,
          lastMessageId: message._id,
        },
      ],
    });
    console.log('✅ ChatList Created for User');

    console.log('✅ Seeding Completed Successfully');
  } catch (error) {
    console.error('❌ Error Seeding Data:', error);
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Execute Seed Function
seed();
