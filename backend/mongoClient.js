import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb+srv://souravislam332_db_user:n1tmCNi9nQeE9zRM@cluster0.l80xukz.mongodb.net/?appName=Cluster0';

export const mongoClient = new MongoClient(uri, {
  connectTimeoutMS: 15000,
  serverSelectionTimeoutMS: 15000,
  tls: true,
  tlsAllowInvalidCertificates: true,
});

let mongoDbInstance = null;

export async function connectMongoDB() {
  if (mongoDbInstance) return mongoDbInstance;
  try {
    console.log('🍃 Connecting to MongoDB Atlas Cluster0...');
    await mongoClient.connect();
    mongoDbInstance = mongoClient.db('elite_force_db');
    console.log('✅ MongoDB Atlas connected successfully! High-performance database online.');
    return mongoDbInstance;
  } catch (err) {
    console.warn('⚠️ MongoDB connection warning:', err.message);
    return null;
  }
}

export function getMongoDB() {
  return mongoDbInstance;
}

/**
 * Log telemetry, audit logs, or user notifications into MongoDB Atlas
 */
export async function logToMongoDB(collectionName, documentData) {
  try {
    const dbInstance = getMongoDB() || await connectMongoDB();
    if (dbInstance) {
      await dbInstance.collection(collectionName).insertOne({
        ...documentData,
        createdAt: new Date(),
      });
    }
  } catch (err) {
    console.warn(`⚠️ Failed to insert into MongoDB [${collectionName}]:`, err.message);
  }
}
