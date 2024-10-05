import mongoose from 'mongoose';
import { SchemaMethods } from "./../shared/services/database/schema_methods.service.js";
const MessageSchema = new mongoose.Schema(
    {
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            refPath: "senderRole"
        },
        receiverId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            refPath: "receiverRole"
        },
        roomId: {
            type: String
        },
        message: {
            type: String
        },
        documents: {
            type: Array
        },
        date: {
            type: String,
        },
        reaction: [
            {
                userId: {
                    type: mongoose.Schema.Types.ObjectId,
                    required: true,
                    refPath: "userRole"
                },
                userRole: {
                    type: String,
                    required: true,
                    enum: ["Users", "Doctor"]
                },
                reactionName: {
                    type: String
                }
            }
        ],
        senderRole: {
            type: String,
            required: true,
            enum: ["User", "Doctor"]
        },
        receiverRole: {
            type: String,
            required: true,
            enum: ["User", "Doctor"]
        },
        isRead: {
            type: Boolean
        }
    },
    {
        timestamps: true
    }
);

const message = mongoose.model("Message", MessageSchema);
SchemaMethods(message)
export default message;
