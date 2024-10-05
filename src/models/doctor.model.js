// models/doctor.model.js
import mongoose from "mongoose";
import { SchemaMethods } from "./../shared/services/database/schema_methods.service.js";

const DoctorSchema = new mongoose.Schema(
    {
        firstName: {
            type: String,
            required: true
        },
        lastName: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true,
            unique: true // Ensure unique emails for doctors
        },
        password: {
            type: String,
            required: true
        },
        contactNumber: {
            type: String,
            required: true
        },
        gender: {
            type: String,
            required: true,
            enum: ['Male', 'Female', 'Other'] // Define acceptable values
        },
        role: {
            type: String,
            required: true,
            enum: ['Doctor'] // Since this is the Doctor model
        },
        destination: {
            type: String,
            required: true
        },
        totalPatients: {
            type: Number, // Changed to Number for consistency
            required: true,
            default: 0
        },
        experience: {
            type: Number,
            required: true
        },
        rating: {
            type: Number,
            required: true,
            default: 0
        },
        review: {
            type: String,
            required: false,
            default: ""
        },
        about: {
            type: String,
            required: false,
            default: ""
        },
        profileImage:{
            type: String,
            default: ""
        },
        token: {
            type: String,
            required: false,
            default: ""
        },
        bankingDetails: {
            accountName: {
                type: String,
                required: true
            },
            accountNumber: {
                type: String,
                required: true
            },
            bankName: {
                type: String,
                required: true
            },
            bankAddress: {
                type: String,
                required: true
            },
            IbanNumber: {
                type: String,
                required: true
            },
            accountType: {
                type: String,
                required: true,
                enum: ['Savings', 'Checking'] // Define acceptable values
            }
        },
        isOnline: {
            type: Boolean,
            default: true,
        }
    },
    {
        timestamps: true,
    }
);

// Adding custom methods to the schema
DoctorSchema.statics.get = async function(filter, projection = {}) {
    return this.find(filter, projection).lean();
};

const Doctor = mongoose.model("Doctor", DoctorSchema);
SchemaMethods(Doctor);
export default Doctor;
