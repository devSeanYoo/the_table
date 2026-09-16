export function addNews(state, text) {
  state.news.push({ id: state.nextNewsId++, round: state.round, text, ts: Date.now() });
}

export function addAdminLog(state, action, detail) {
  state.adminLog.push({ id: state.nextLogId++, ts: Date.now(), action, detail });
}
