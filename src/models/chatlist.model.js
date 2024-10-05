// models/chatlist.model.js
import mongoose from 'mongoose';
import { SchemaMethods } from "./../shared/services/database/schema_methods.service.js";

const ChatSchema = new mongoose.Schema({
  participantId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    // No refPath; we'll handle population manually
  },
  role: {
    type: String,
    required: true,
    enum: ['User', 'Doctor']
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Room",
    required: true
  },
  lastMessageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message",
    required: true
  }
}, { _id: false });

const ChatListSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      // No refPath; we'll handle population manually
    },
    role: { // Renamed from senderRole to role for clarity
      type: String,
      required: true,
      enum: ['User', 'Doctor']
    },
    chats: [ChatSchema]
  },
  {
    timestamps: true
  }
);

// Adding custom methods to the schema
ChatListSchema.statics.get = async function(filter, projection = {}) {
  return this.find(filter, projection).lean();
};

const ChatList = mongoose.model("ChatList", ChatListSchema);
SchemaMethods(ChatList);
export default ChatList;
