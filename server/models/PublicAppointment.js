const mongoose = require("mongoose");

const PublicAppointmentSchema = new mongoose.Schema(
  {
    motherName: {
      type: String,
      required: [true, "Please provide the mother's name"],
      trim: true
    },
    fatherName: {
      type: String,
      required: [true, "Please provide the father's name"],
      trim: true
    },
    childName: {
      type: String,
      required: [true, "Please provide the child's name"],
      trim: true
    },
    contactNumber: {
      type: String,
      required: [true, "Please provide a contact number"],
      trim: true
    },
    email: {
      type: String,
      required: [true, "Please provide an email address"],
      match: [
        /^([\w-\.]+@([\w-]+\.)+[\w-]{2,4})?$/,
        "Please provide a valid email address"
      ],
      trim: true
    },
    childAge: {
      type: String,
      required: [true, "Please provide the child's age group"],
      trim: true
    },
    serviceType: {
      type: String,
      required: [true, "Please provide the service type"],
      enum: ["assessment", "therapy", "consultation", "follow-up", "other"]
    },
    preferredTime: {
      type: String,
      required: [true, "Please provide a preferred time"],
      trim: true
    },
    specialNeeds: {
      type: String,
      required: false,
      trim: true
    },
    preferredDate: {
      type: Date,
      required: [true, "Please provide a preferred date"]
    },
    paymentMethod: {
      type: String,
      required: [true, "Please provide a payment method"],
      enum: ["credit_card", "debit_card", "cash", "online_transfer"],
      default: "credit_card"
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "rejected", "converted"],
      default: "pending"
    },
    notes: {
      type: String,
      required: false,
      trim: true
    },
    convertedToAppointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("PublicAppointment", PublicAppointmentSchema); 