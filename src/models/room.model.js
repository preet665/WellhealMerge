// models/room.model.js
import mongoose from 'mongoose';
import { SchemaMethods } from "./../shared/services/database/schema_methods.service.js";

const ParticipantSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    // No refPath; we'll handle population manually
  },
  role: {
    type: String,
    required: true,
    enum: ['User', 'Doctor']
  }
}, { _id: false });

const RoomSchema = new mongoose.Schema(
  {
    participants: {
      type: [ParticipantSchema],
      validate: {
        validator: function(v) {
          return v.length === 2;
        },
        message: "A room must have exactly two participants."
      }
    }
  },
  {
    timestamps: true
  }
);

// Adding custom methods to the schema
RoomSchema.statics.get = async function(filter, projection = {}) {
  return this.find(filter, projection).lean();
};

RoomSchema.statics.createRoom = async function(participants) {
  // Ensure exactly two participants
  if (participants.length !== 2) {
    throw new Error("A room must have exactly two participants.");
  }

  // Sort participants to maintain consistency
  const sortedParticipants = participants.sort((a, b) => {
    if (a.role === b.role) {
      return a.userId.toString().localeCompare(b.userId.toString());
    }
    return a.role.localeCompare(b.role);
  });

  // Check if a room with the same participants already exists
  const existingRoom = await this.findOne({
    participants: {
      $all: sortedParticipants.map(p => ({
        userId: p.userId,
        role: p.role
      })),
      $size: sortedParticipants.length
    }
  });

  if (existingRoom) {
    return existingRoom;
  }

  // Create a new room
  const newRoom = await this.create({ participants: sortedParticipants });
  return newRoom;
};

// Create the Mongoose model
const Room = mongoose.model("Room", RoomSchema);
SchemaMethods(Room);
export default Room;
