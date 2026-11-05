/**
 * Per-user custom model storage (Firestore when configured; in-memory fallback).
 * Only CIPHERTEXT is stored — plaintext keys never touch storage.
 */

import { initializeApp, getApps, cert, type App } from 'firebase-admin';
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { VercelRequest } from '@vercel/node';
import { resolveAuth } from './auth';
import { decryptKey } from './secrets';

export interface CustomModelMeta {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  createdAt: number;
}

export interface CustomModelRecord extends CustomModelMeta {
  /** base64 RSA-OAEP ciphertext of the provider API key. */
  encryptedKey: string;
}

let app: App | null = null;
let attempted = false;
let db: Firestore | null = null;

function getDb(): Firestore | null {
  if (attempted) return db;
  attempted = true;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as Record<string, string>;
    const existing = getApps()[0];
    app = existing ?? initializeApp({ credential: cert(sa as any) });
    db = getFirestore(app);
  } catch {
    db = null;
  }
  return db;
}

const memoryStore = new Map<string, CustomModelRecord[]>();

export async function requireUid(req: VercelRequest): Promise<string | null> {
  const { uid } = await resolveAuth(req);
  return uid;
}

export async function listCustomModels(uid: string): Promise<CustomModelMeta[]> {
  const fs = getDb();
  if (fs) {
    const snap = await fs.collection('users').doc(uid).collection('models').orderBy('createdAt', 'desc').get();
    return snap.docs.map((d) => {
      const data = d.data() as Partial<CustomModelRecord>;
      return {
        id: d.id,
        name: data.name ?? '',
        baseUrl: data.baseUrl ?? '',
        model: data.model ?? '',
        createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
      };
    });
  }
  return (memoryStore.get(uid) ?? []).map(({ encryptedKey: _k, ...meta }) => meta);
}

export async function saveCustomModel(
  uid: string,
  input: { name: string; baseUrl: string; model: string; encryptedKey: string }
): Promise<CustomModelMeta> {
  const fs = getDb();
  if (fs) {
    const ref = await fs.collection('users').doc(uid).collection('models').add({
      name: input.name,
      baseUrl: input.baseUrl,
      model: input.model,
      encryptedKey: input.encryptedKey,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { id: ref.id, name: input.name, baseUrl: input.baseUrl, model: input.model, createdAt: Date.now() };
  }
  const list = memoryStore.get(uid) ?? [];
  const record: CustomModelRecord = {
    id: `m-${Date.now().toString(36)}`,
    name: input.name,
    baseUrl: input.baseUrl,
    model: input.model,
    encryptedKey: input.encryptedKey,
    createdAt: Date.now(),
  };
  list.unshift(record);
  memoryStore.set(uid, list);
  const { encryptedKey: _k, ...meta } = record;
  return meta;
}

export async function getCustomModel(uid: string, id: string): Promise<CustomModelRecord | null> {
  const fs = getDb();
  if (fs) {
    const doc = await fs.collection('users').doc(uid).collection('models').doc(id).get();
    if (!doc.exists) return null;
    const data = doc.data() as Partial<CustomModelRecord>;
    return {
      id: doc.id,
      name: data.name ?? '',
      baseUrl: data.baseUrl ?? '',
      model: data.model ?? '',
      encryptedKey: data.encryptedKey ?? '',
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
    };
  }
  return (memoryStore.get(uid) ?? []).find((m) => m.id === id) ?? null;
}

export async function deleteCustomModel(uid: string, id: string): Promise<boolean> {
  const fs = getDb();
  if (fs) {
    await fs.collection('users').doc(uid).collection('models').doc(id).delete();
    return true;
  }
  const list = memoryStore.get(uid) ?? [];
  const next = list.filter((m) => m.id !== id);
  memoryStore.set(uid, next);
  return next.length !== list.length;
}

export async function resolveCustomApiKey(uid: string, id: string): Promise<string | null> {
  const record = await getCustomModel(uid, id);
  if (!record || !record.encryptedKey) return null;
  try {
    return decryptKey(record.encryptedKey);
  } catch {
    return null;
  }
}
