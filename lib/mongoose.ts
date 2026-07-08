import mongoose from "mongoose";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & {
  mongooseCache?: MongooseCache;
};

const cached = globalForMongoose.mongooseCache ?? {
  conn: null,
  promise: null
};

globalForMongoose.mongooseCache = cached;

function getMongoUri() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  return uri;
}

export async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  cached.promise ??= mongoose.connect(getMongoUri(), {
    bufferCommands: false
  });

  cached.conn = await cached.promise;
  return cached.conn;
}
