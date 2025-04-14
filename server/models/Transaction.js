const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true,
  },
  transactionPrefix: {
    type: String,
    default: "TSK/DS",
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subscription",
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
  customerName: {
    type: String,
    required: true,
  },
  customerEmail: {
    type: String,
    required: true,
  },
  customerPhone: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: "INR",
  },
  paymentMethod: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "successful", "failed", "refunded"],
    default: "pending",
  },
  paymentDetails: {
    orderId: String,
    paymentId: String,
    method: String,
    bank: String,
    wallet: String,
    vpa: String,
    email: String,
    contact: String,
    fee: Number,
    tax: Number,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  refundDetails: [
    {
      amount: Number,
      reason: String,
      date: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true
});

// Generate transaction ID if not provided
TransactionSchema.pre("save", function (next) {
  if (!this.transactionId) {
    const randomId = Math.floor(1000 + Math.random() * 9000);
    this.transactionId = `${this.transactionPrefix}${randomId}`;
  }
  this.updatedAt = Date.now();
  next();
});

// Indexes
TransactionSchema.index({ order: 1 });
TransactionSchema.index({ user: 1 });
TransactionSchema.index({ status: 1 });
TransactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Transaction", TransactionSchema);
