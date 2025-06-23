function safeStringify(obj) {
  return JSON.stringify(obj, (key, value) => {
    // Handle ObjectId, BigInt, etc.
    if (typeof value === 'bigint') {
      return value.toString();
    }
    if (value && typeof value.toHexString === 'function') {
      return value.toHexString();
    }
    return value;
  });
}

module.exports = {
    safeStringify,
};