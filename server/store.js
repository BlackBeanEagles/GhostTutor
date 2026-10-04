// Student memory: MongoDB Atlas when MONGODB_URI is set, otherwise a local JSON file.
import fs from 'node:fs';
import path from 'node:path';
import { MongoClient } from 'mongodb';
import { config, ROOT } from './config.js';

const FILE = path.join(ROOT, 'data', 'db.json');
const empty = () => ({ profile: defaultProfile(), chunks: [], attempts: [], questions: {} });

function defaultProfile() {
  return {
    name: 'Friend',
    subject: 'My subject',
    examDate: null,
    persona: 'gentle',
    topics: [],
    streak: 0,
    lastQuizDay: null,
    memories: [],
  };
}

class FileStore {
  constructor() {
    this.kind = 'local-file';
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    this.db = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : empty();
  }
  flush() {
    fs.writeFileSync(FILE, JSON.stringify(this.db));
  }
  async getProfile() { return this.db.profile; }
  async saveProfile(p) { this.db.profile = { ...this.db.profile, ...p }; this.flush(); return this.db.profile; }
  async addChunks(chunks) { this.db.chunks.push(...chunks); this.flush(); }
  async allChunks() { return this.db.chunks; }
  async clearNotes() { this.db.chunks = []; this.db.profile.topics = []; this.flush(); }
  async addAttempt(a) { this.db.attempts.push(a); this.flush(); }
  async attempts() { return this.db.attempts; }
  async saveQuestion(q) { this.db.questions[q.id] = q; this.flush(); }
  async getQuestion(id) { return this.db.questions[id] ?? null; }
}

class MongoStore {
  constructor(uri) {
    this.kind = 'mongodb-atlas';
    this.client = new MongoClient(uri);
  }
  async init() {
    await this.client.connect();
    this.d = this.client.db('ghosttutor');
  }
  async getProfile() {
    const p = await this.d.collection('profile').findOne({ _id: 'me' });
    return p ?? { _id: 'me', ...defaultProfile() };
  }
  async saveProfile(p) {
    const { _id, ...rest } = p;
    await this.d.collection('profile').updateOne({ _id: 'me' }, { $set: rest }, { upsert: true });
    return this.getProfile();
  }
  async addChunks(chunks) { if (chunks.length) await this.d.collection('chunks').insertMany(chunks.map((c) => ({ ...c }))); }
  async allChunks() { return this.d.collection('chunks').find({}, { projection: { _id: 0 } }).toArray(); }
  async clearNotes() {
    await this.d.collection('chunks').deleteMany({});
    await this.saveProfile({ topics: [] });
  }
  async addAttempt(a) { await this.d.collection('attempts').insertOne({ ...a }); }
  async attempts() { return this.d.collection('attempts').find({}, { projection: { _id: 0 } }).sort({ at: 1 }).toArray(); }
  async saveQuestion(q) { await this.d.collection('questions').replaceOne({ id: q.id }, q, { upsert: true }); }
  async getQuestion(id) { return this.d.collection('questions').findOne({ id }, { projection: { _id: 0 } }); }
}

export async function createStore() {
  if (config.mongoUri) {
    try {
      const s = new MongoStore(config.mongoUri);
      await s.init();
      return s;
    } catch (e) {
      console.warn('[store] MongoDB unavailable, using local file:', e.message);
    }
  }
  return new FileStore();
}
