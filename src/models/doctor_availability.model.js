import mongoose from "mongoose";
import { SchemaMethods } from "./../shared/services/database/schema_methods.service.js";

const doctorAvailability = new mongoose.Schema(
    {
        doctorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Doctor",
            require: true
        },
        date: {
            type: String,
            require: true,
        },
        mode: {
            type: [{
                type: mongoose.Schema.Types.ObjectId,
                ref: "Mode",
            }],
        },
        slot:
            [
                {
                    time: { type: String, require: true },
                    isBooked: { type: Boolean, require: true, default: false }
                }
            ]
    },
    {
        timestamps: true,
    }
);

const DoctorAvailability = mongoose.model("DoctorAvailability", doctorAvailability);
SchemaMethods(DoctorAvailability);
export default DoctorAvailability;
