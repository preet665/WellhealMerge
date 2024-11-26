import mongoose from "mongoose";
import {SchemaMethods} from "./../shared/services/database/schema_methods.service.js";

const ModeSchema = new mongoose.Schema({
    name: {
        type: String,
        require: true
    },
    price: {
        type: Number,
        require: true
    },
    currency: {
        type: String,
        default: 'USD'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    doctorId: {
        type: mongoose.Schema.Types.ObjectId,
        require: true
    },
    description: {
        type: String,
        default: "",  // Default to an empty string if not provided
    },
}, {
    timestamps: true,
});

const Mode = mongoose.model("Mode", ModeSchema);

// Attach SchemaMethods
SchemaMethods(Mode);

export default Mode;
