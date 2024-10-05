import mongoose from 'mongoose';
import { SchemaMethods } from "./../shared/services/database/schema_methods.service.js";
const chatListSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            refPath: "senderRole"
        },
        senderRole: {
            type: String,
            required: true,
            enum: ["User", "Doctor"]
        },
        list: [
            {
                userId: {
                    type: mongoose.Schema.Types.ObjectId,
                    required: true,
                    refPath: "receiverRole"
                },
                receiverRole: {
                    type: String,
                    required: true,
                    enum: ["User", "Doctor"]
                },
                roomId: {
                    type: String
                },
                lastMessage: {
                    type: mongoose.Schema.Types.ObjectId,
                    required: true,
                    ref: "Message"
                },
            }
        ]
    },
    {
        timestamps: true
    }
);

const chatlist =  mongoose.model("ChatList", chatListSchema);
SchemaMethods(chatlist)
export default chatlist;
