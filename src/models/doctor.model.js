import mongoose from "mongoose";
import { SchemaMethods } from "./../shared/services/database/schema_methods.service.js";

const DoctorSchema = new mongoose.Schema(
    {
        firstName: {
            type: String,
            require: true
        },
        lastName: {
            type: String,
            require: true
        },
        email: {
            type: String,
            require: true
        },
        password: {
            type: String,
            require: true
        },
        contactNumber: {
            type: String,
            require: true
        },
        gender: {
            type: String,
            require: true
        },
        role: {
            type: String,
            require: true
        },
        destination: {
            type: String,
            require: true
        },
        totalPatients: {
            type: String,
            require: true
        },
        experience: {
            type: Number,
            require: true
        },
        rating: {
            type: Number,
            require: true
        },
        review: {
            type: String,
            require: true
        },
        about: {
            type: String,
            require: true
        },
        profileImage:{
            type: String,
        },
        token: {
            type: String,
            require: true
        },
        bankingDetails: {
            type: {
                accountName: {
                    type: String,
                    require: true
                },
                accountNumber: {
                    type: String,
                    require: true
                },
                bankName: {
                    type: String,
                    require: true
                },
                bankAddress: {
                    type: String,
                    require: true
                },
                IbanNumber: {
                    type: String,
                    require: true
                },
                accountType: {
                    type: String,
                    require: true
                },
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

//module.exports = mongoose.model("Doctor", DoctorSchema);
//const Appointment = mongoose.model('Appointment', AppointmentSchema);

const Doctor = mongoose.model("Doctor", DoctorSchema);
SchemaMethods(Doctor)
export default Doctor;
