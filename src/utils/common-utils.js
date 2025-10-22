const roundOff = (value, decimals = 2) => {
  if (typeof value !== 'number' || isNaN(value)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
};

module.exports = { roundOff };
