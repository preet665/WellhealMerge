// src/models/review_rating.model.js
import mongoose from "mongoose";
import { SchemaMethods } from "./../shared/services/database/schema_methods.service.js";

const CallReviewRatingSchema = new mongoose.Schema(
    {
        doctorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Doctor", // Ensure this matches the exact name of your Doctor model
            required: true,
        },
        callId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Call", // Replace "Call" with the actual name of your Call model if different
            required: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User", // Ensure this matches the exact name of your User model
            required: true,
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },
        review: {
            type: String,
            required: false,
            trim: true,
            maxlength: 1000,
        },
    },
    {
        timestamps: true,
    }
);

// Attach Schema Methods if necessary
const CallReviewRating = mongoose.model("CallReviewRating", CallReviewRatingSchema);

// Then apply SchemaMethods
SchemaMethods(CallReviewRating);

export default CallReviewRating;
