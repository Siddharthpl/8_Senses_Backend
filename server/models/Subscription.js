const mongoose = require("mongoose");

const SubscriptionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a name"],
    },
    email: {
      type: String,
      required: [true, "Please add an email"],
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please add a valid email",
      ],
      unique: true,
    },
    phone: {
      type: String,
      required: [true, "Please add a phone number"],
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      required: [true, "Please add a subscription plan"],
    },
    currentTier: {
      type: String,
      required: [true, "Please add current tier"],
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: [true, "Please add end date"],
    },
    nextRenewalDate: {
      type: Date,
      required: [true, "Please add next renewal date"],
    },
    paymentStatus: {
      type: String,
      enum: ["paid", "pending", "failed", "cancelled"],
      default: "pending",
    },
    autoRenew: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    paymentHistory: [
      {
        amount: {
          type: Number,
        },
        status: {
          type: String,
          enum: ["successful", "failed", "pending", "refunded"],
        },
        paymentMethod: {
          type: String,
        },
        transactionId: {
          type: String,
        },
        date: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    metadata: {
      razorpayOrderId: String,
      razorpayPaymentId: String,
      razorpaySignature: String,
      lastPaymentDate: Date,
      nextPaymentDate: Date,
      paymentGateway: {
        type: String,
        enum: ["razorpay", "stripe", "paypal", "manual"],
        default: "razorpay"
      },
      subscriptionId: String,
      customerId: String,
    }
  },
  {
    timestamps: true,
  }
);

// Virtual for checking if subscription is expired
SubscriptionSchema.virtual("isExpired").get(function () {
  return new Date() > this.endDate;
});

// Virtual for days remaining in subscription
SubscriptionSchema.virtual("daysRemaining").get(function () {
  const today = new Date();
  const end = new Date(this.endDate);
  const diffTime = Math.abs(end - today);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

module.exports = mongoose.model("Subscription", SubscriptionSchema);
