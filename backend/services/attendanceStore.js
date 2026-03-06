class AttendanceStore {
  constructor() {
    this.items = new Map();
    this.ttlMs = 1000 * 60 * 60 * 6;
  }

  save(rows, uploadedBy) {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    this.items.set(id, {
      id,
      rows,
      uploadedBy,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.ttlMs,
    });
    return id;
  }

  get(id) {
    const record = this.items.get(id);
    if (!record) return null;
    if (record.expiresAt < Date.now()) {
      this.items.delete(id);
      return null;
    }
    return record;
  }

  clear(id) {
    this.items.delete(id);
  }
}

module.exports = new AttendanceStore();
