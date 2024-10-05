// src/models/call.model.js

import mongoose from "mongoose";
import { SchemaMethods } from "./../shared/services/database/schema_methods.service.js";

// Define the Call Schema
const CallSchema = new mongoose.Schema(
    {
        doctorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Doctor", // Ensure this matches the exact name of your Doctor model
            required: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User", // Ensure this matches the exact name of your User model
            required: true,
        },
        appointmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Appointment", // Reference to the Appointment model
            required: true,
        },
        date: {
            type: Date, // Using Date type for accurate date representation
            required: true,
        },
        timeSlot: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "DoctorAvailability", // Reference to the DoctorAvailability model
            required: true,
        },
        status: {
            type: String,
            enum: ["Scheduled", "In-Call", "Completed", "Cancelled", "No-Show"],
            default: "Scheduled",
            required: true,
        },
        startTime: {
            type: Date,
            default: null,
        },
        endTime: {
            type: Date,
            default: null,
        },
        duration: {
            type: Number, // Duration in minutes
            default: 0,
        },
        videoLink: {
            type: String,
            default: "",
            trim: true,
        },
        paymentStatus: {
            type: String,
            enum: ["Pending", "Done"],
            default: "Pending",
            required: true,
        },
        rating: {
            type: Number,
            min: 1,
            max: 5,
        },
        review: {
            type: String,
            trim: true,
            maxlength: 1000,
        },
        callType: {
            type: String,
            enum: ["audio", "video"],
            default: "video",
            required: true,
        },
        agoraChannel: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        agoraToken: {
            type: String,
            required: true,
            trim: true,
        },
    },
    {
        timestamps: true, // Automatically adds createdAt and updatedAt fields
    }
);
CallSchema.pre('save', function(next) {
    if (this.endTime && this.startTime) {
        // Calculate duration in seconds
       // this.duration = Math.round((this.endTime - this.startTime) / 1000);
        
        // Alternatively, duration in minutes with two decimal places
        this.duration = Math.round(((this.endTime - this.startTime) / 60000) * 100) / 100;
    }
    next();
});
// Attach Schema Methods if necessary
const Call = mongoose.model("Call", CallSchema);

// Then apply SchemaMethods
SchemaMethods(Call);

export default Call;
