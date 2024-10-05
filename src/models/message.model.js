// models/message.model.js
import mongoose from 'mongoose';
import { SchemaMethods } from "./../shared/services/database/schema_methods.service.js";

const ReactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    // No refPath; we'll handle population manually
  },
  userRole: {
    type: String,
    required: true,
    enum: ['User', 'Doctor']
  },
  reactionName: {
    type: String
  }
}, { _id: false });

const MessageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      // No refPath; we'll handle population manually
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      // No refPath; we'll handle population manually
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true
    },
    message: {
      type: String
    },
    documents: {
      type: Array
    },
    date: {
      type: Date, // Changed to Date for proper date handling
      default: Date.now
    },
    reaction: [ReactionSchema],
    senderRole: {
      type: String,
      required: true,
      enum: ['User', 'Doctor']
    },
    receiverRole: {
      type: String,
      required: true,
      enum: ['User', 'Doctor']
    },
    isRead: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Adding custom methods to the schema
MessageSchema.statics.get = async function(filter, projection = {}) {
  return this.find(filter, projection).lean();
};

const Message = mongoose.model("Message", MessageSchema);
SchemaMethods(Message);
export default Message;
