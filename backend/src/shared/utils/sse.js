const clients = new Map();

function addClient(userId, res) {
  if (!clients.has(userId)) clients.set(userId, []);
  clients.get(userId).push(res);
  res.on('close', () => {
    const list = clients.get(userId);
    if (list) {
      const idx = list.indexOf(res);
      if (idx !== -1) list.splice(idx, 1);
      if (list.length === 0) clients.delete(userId);
    }
  });
}

function sendToUser(userId, event, data) {
  const list = clients.get(userId);
  if (list) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of list) res.write(payload);
  }
}

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [, list] of clients) {
    for (const res of list) res.write(payload);
  }
}

export { addClient, sendToUser, broadcast };
