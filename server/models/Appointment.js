const mongoose = require("mongoose");

const AppointmentSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: [true, "Please provide patient ID"]
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Please provide doctor ID"]
    },
    date: {
      type: Date,
      required: [true, "Please provide appointment date"]
    },
    timeSlot: {
      type: String,
      required: [true, "Please provide time slot"]
    },
    primaryConcern: {
      type: String,
      required: [true, "Please provide primary concern"]
    },
    documents: [{
      type: String // URLs from file upload API
    }],
    status: {
      type: String,
      enum: ["Pending Confirmation", "Confirmed", "Cancelled"],
      default: "Pending Confirmation"
    },
    notes: {
      type: String
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Index for faster queries
AppointmentSchema.index({ patientId: 1, date: 1 });
AppointmentSchema.index({ doctorId: 1, date: 1, timeSlot: 1 });

module.exports = mongoose.model("Appointment", AppointmentSchema);