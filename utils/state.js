const state = new Map();

module.exports = {
  set(id, value) {
    state.set(id, value);
  },
  get(id) {
    return state.get(id);
  },
  clear(id) {
    state.delete(id);
  },
};
