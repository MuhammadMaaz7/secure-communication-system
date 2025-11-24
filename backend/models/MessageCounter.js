const mongoose = require('mongoose');

const messageCounterSchema = new mongoose.Schema({
  conversationId: {
    type: String,
    required: true,
    unique: true
  },
  counter: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

messageCounterSchema.statics.getNextSequence = async function(senderId, receiverId) {
  const conversationId = [senderId, receiverId].sort().join('_');
  
  const result = await this.findOneAndUpdate(
    { conversationId },
    { $inc: { counter: 1 } },
    { new: true, upsert: true }
  );
  
  return result.counter;
};

module.exports = mongoose.model('MessageCounter', messageCounterSchema);
