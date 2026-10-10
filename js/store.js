(function () {
// Local storage backed Watch later + History
const read = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const store = {
  later: () => read('pt_later'),
  isSaved: (id) => read('pt_later').includes(id),
  toggleSaved(id) {
    const list = read('pt_later');
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1); else list.unshift(id);
    write('pt_later', list);
    return i < 0;
  },
  history: () => read('pt_history'),
  addHistory(id) {
    const list = read('pt_history').filter((x) => x !== id);
    list.unshift(id);
    write('pt_history', list.slice(0, 100));
  },
  clearHistory: () => write('pt_history', []),
};

window.PT_STORE = store;
})();
